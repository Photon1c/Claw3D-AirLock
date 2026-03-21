import { NextResponse } from "next/server";

import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
  runSshJson,
} from "@/lib/ssh/gateway-host";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import { resolveSandboxRootDir } from "@/lib/studio/workspace";
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

const isPathWithinRoot = (rootDir: string, candidatePath: string) => {
  const relative = path.relative(rootDir, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const resolveAndValidateLocalMediaPath = (
  raw: string,
  sandboxRootDir: string
): { resolved: string; mime: string } => {
  const { trimmed, mime } = validateRawMediaPath(raw);

  const resolvedRoot = path.resolve(expandTildeLocal(sandboxRootDir));
  const expanded = expandTildeLocal(trimmed);
  const resolved = path.isAbsolute(expanded)
    ? path.resolve(expanded)
    : path.resolve(resolvedRoot, expanded);
  if (!isPathWithinRoot(resolvedRoot, resolved)) {
    throw new Error(`Refusing to read media outside sandbox root ${resolvedRoot}`);
  }

  return { resolved, mime };
};

const validateRemoteMediaPath = (
  raw: string,
  sandboxRootDir: string
): { remotePath: string; remoteRoot: string; mime: string } => {
  const { trimmed, mime } = validateRawMediaPath(raw);
  const remoteRoot = sandboxRootDir.trim().replaceAll("\\", "/");
  if (!remoteRoot) {
    throw new Error("Sandbox root is required for remote media reads.");
  }
  const normalized = trimmed.replaceAll("\\", "/");
  const remotePath =
    normalized.startsWith("/") || normalized.startsWith("~")
      ? normalized
      : `${remoteRoot.replace(/\/+$/, "")}/${normalized}`;
  return { remotePath, remoteRoot, mime };
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

python3 - "$1" "$2" <<'PY'
import base64
import json
import mimetypes
import os
import pathlib
import sys

raw = sys.argv[1].strip()
allowed_root_raw = sys.argv[2].strip()
if not raw:
  print(json.dumps({"error": "path is required"}))
  raise SystemExit(2)
if not allowed_root_raw:
  print(json.dumps({"error": "sandbox root is required"}))
  raise SystemExit(2)

p = pathlib.Path(os.path.expanduser(raw))
try:
  resolved = p.resolve(strict=True)
except FileNotFoundError:
  print(json.dumps({"error": f"file not found: {raw}"}))
  raise SystemExit(3)

allowed = pathlib.Path(os.path.expanduser(allowed_root_raw)).resolve(strict=False)
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
max_bytes = ${MAX_MEDIA_BYTES}
if size > max_bytes:
  print(json.dumps({"error": f"media file too large ({size} bytes)"}))
  raise SystemExit(6)

data = base64.b64encode(resolved.read_bytes()).decode("ascii")
print(json.dumps({"ok": True, "mime": mime, "size": size, "data": data}))
PY
`;

const resolveSshTarget = (gatewayUrl: string): string | null => {
  if (isLocalGatewayUrl(gatewayUrl)) return null;
  const configured = resolveConfiguredSshTarget(process.env);
  if (configured) return configured;
  return resolveGatewaySshTargetFromGatewayUrl(gatewayUrl, process.env);
};

const resolveRemoteSandboxRoot = (value: unknown): string => {
  if (typeof value !== "string") return "~/.claw3d/sandboxes";
  const trimmed = value.trim();
  return trimmed || "~/.claw3d/sandboxes";
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = (searchParams.get("path") ?? "").trim();
    const settings = loadStudioSettings();
    const gatewayUrl = settings.gateway?.url ?? "";
    const sandboxRootDir = resolveSandboxRootDir(settings, process.env);
    const remoteSandboxRoot = resolveRemoteSandboxRoot(settings.workspace?.sandboxRootDir);
    const sshTarget = resolveSshTarget(gatewayUrl);

    if (!sshTarget) {
      const { resolved, mime } = resolveAndValidateLocalMediaPath(rawPath, sandboxRootDir);
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

    const { remotePath, remoteRoot, mime } = validateRemoteMediaPath(rawPath, remoteSandboxRoot);

    const payload = runSshJson({
      sshTarget,
      argv: ["bash", "-s", "--", remotePath, remoteRoot],
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
