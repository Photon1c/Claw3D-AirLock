import { NextResponse } from "next/server";

import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
  runSshJson,
} from "@/lib/ssh/gateway-host";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export const runtime = "nodejs";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const expandTildeLocal = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
};

const validateRawMediaPath = (raw: string): { trimmed: string; mime: string } => {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("path is required");
  if (trimmed.length > 4096) throw new Error("path too long");
  if (/[^\S\r\n]*[\0\r\n]/.test(trimmed)) throw new Error("path contains invalid characters");

  const ext = path.extname(trimmed).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error(`Unsupported media extension: ${ext || "(none)"}`);

  return { trimmed, mime };
};

const resolveAndValidateLocalMediaPath = (
  raw: string,
  env: NodeJS.ProcessEnv = process.env
): { resolved: string; mime: string } => {
  const { trimmed, mime } = validateRawMediaPath(raw);

  const expanded = expandTildeLocal(trimmed);
  if (!path.isAbsolute(expanded)) {
    throw new Error("path must be absolute or start with ~/");
  }

  const resolved = path.resolve(expanded);

  const allowedRoot = (env.OPENCLAW_STATE_DIR?.trim())
    ? path.resolve(expanded.startsWith("~") ? expandTildeLocal(env.OPENCLAW_STATE_DIR.trim()) : env.OPENCLAW_STATE_DIR.trim())
    : env.AIRLOCK_SANDBOX_MODE?.trim().toLowerCase() === "1" || env.CLAW3D_SANDBOX?.trim().toLowerCase() === "1"
    ? path.join(os.tmpdir(), "claw3d_sandbox")
    : null;

  if (allowedRoot === null) {
    throw new Error(
      "OPENCLAW_STATE_DIR is not set. " +
        "Set it explicitly or enable sandbox mode with AIRLOCK_SANDBOX_MODE=1."
    );
  }

  const allowedPrefix = `${allowedRoot}${path.sep}`;
  if (!(resolved === allowedRoot || resolved.startsWith(allowedPrefix))) {
    throw new Error(`Refusing to read media outside the configured state directory: ${allowedRoot}`);
  }

  return { resolved, mime };
};

const validateRemoteMediaPath = (
  raw: string,
  env: NodeJS.ProcessEnv = process.env
): { remotePath: string; mime: string } => {
  const { trimmed, mime } = validateRawMediaPath(raw);

  if (!(trimmed.startsWith("/") || trimmed === "~" || trimmed.startsWith("~/"))) {
    throw new Error("path must be absolute or start with ~/");
  }

  const stateDir = env.OPENCLAW_STATE_DIR?.trim();
  if (!stateDir) {
    throw new Error(
      "OPENCLAW_STATE_DIR must be set for remote media access. " +
        "Remote media does not support sandbox mode."
    );
  }

  const resolved = path.resolve(trimmed.replaceAll("\\\\", "/"));
  const resolvedRoot = path.resolve(stateDir);
  const rootPrefix = `${resolvedRoot}${path.sep}`;
  if (!(resolved === resolvedRoot || resolved.startsWith(rootPrefix))) {
    throw new Error(`Refusing to read remote media outside the configured state directory: ${resolvedRoot}`);
  }

  return { remotePath: trimmed, mime };
};

const readLocalMedia = async (resolvedPath: string): Promise<{ bytes: Buffer; size: number }> => {
  const stat = await fs.stat(resolvedPath);
  if (!stat.isFile()) {
    throw new Error("path is not a file");
  }
  if (stat.size > MAX_MEDIA_BYTES) {
    throw new Error(`media file too large (${stat.size} bytes)`);
  }
  const buf = await fs.readFile(resolvedPath);
  return { bytes: buf, size: stat.size };
};

const REMOTE_READ_SCRIPT = `
set -euo pipefail

state_dir="\${OPENCLAW_STATE_DIR:-}"
if [[ -z "$state_dir" ]]; then
  echo 'ERROR: OPENCLAW_STATE_DIR is not set. Remote media access requires an explicit state directory.' >&2
  exit 1
fi

python3 - "$1" "$state_dir" <<'PY'
import base64
import json
import mimetypes
import os
import pathlib
import sys

raw = sys.argv[1].strip()
state_dir = sys.argv[2].strip()
if not raw:
  print(json.dumps({"error": "path is required"}))
  raise SystemExit(2)

p = pathlib.Path(os.path.expanduser(raw))
try:
  resolved = p.resolve(strict=True)
except FileNotFoundError:
  print(json.dumps({"error": f"file not found: {raw}"}))
  raise SystemExit(3)

allowed = pathlib.Path(state_dir).resolve()
if resolved != allowed and allowed not in resolved.parents:
  print(json.dumps({"error": f"Refusing to read media outside {allowed}"}))
  raise SystemExit(4)

ext = resolved.suffix.lower()
mime = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
}.get(ext) or (mimetypes.guess_type(str(resolved))[0] or "")

if not mime.startswith("image/"):
  print(json.dumps({"error": f"Unsupported media extension: {ext or '(none)'}"}))
  raise SystemExit(5)

size = resolved.stat().st_size
max_bytes = \${MAX_MEDIA_BYTES}
if size > max_bytes:
  print(json.dumps({"error": f"media file too large ({size} bytes)"}))
  raise SystemExit(6)

data = base64.b64encode(resolved.read_bytes()).decode("ascii")
print(json.dumps({"ok": True, "mime": mime, "size": size, "data": data}))
PY
`;

const resolveSshTarget = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const settings = loadStudioSettings(env);
  const gatewayUrl = settings.gateway?.url ?? "";
  if (isLocalGatewayUrl(gatewayUrl)) return null;
  const configured = resolveConfiguredSshTarget(env);
  if (configured) return configured;
  return resolveGatewaySshTargetFromGatewayUrl(gatewayUrl, env);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = (searchParams.get("path") ?? "").trim();

    const sshTarget = resolveSshTarget(process.env);

    if (!sshTarget) {
      const { resolved, mime } = resolveAndValidateLocalMediaPath(rawPath, process.env);
      const { bytes, size } = await readLocalMedia(resolved);
      const body = new Blob([Uint8Array.from(bytes)], { type: mime });
      return new Response(body, {
        headers: {
          "Content-Type": mime,
          "Content-Length": String(size),
          "Cache-Control": "no-store",
        },
      });
    }

    const { remotePath, mime } = validateRemoteMediaPath(rawPath, process.env);

    const payload = runSshJson({
      sshTarget,
      argv: ["bash", "-s", "--", remotePath],
      label: "gateway media read",
      input: REMOTE_READ_SCRIPT,
      fallbackMessage: `Failed to fetch media over ssh (${sshTarget})`,
      maxBuffer: Math.ceil(MAX_MEDIA_BYTES * 1.6),
    }) as {
      ok?: boolean;
      data?: string;
      mime?: string;
      size?: number;
    };

    const b64 = payload.data ?? "";
    if (!b64) {
      throw new Error("Remote media fetch returned empty data");
    }

    const buf = Buffer.from(b64, "base64");
    const responseMime = payload.mime || mime;
    const body = new Blob([Uint8Array.from(buf)], { type: responseMime });

    return new Response(body, {
      headers: {
        "Content-Type": responseMime,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch media";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
