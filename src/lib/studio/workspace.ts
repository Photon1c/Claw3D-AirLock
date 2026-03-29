import path from "node:path";

import { resolveStateDir, resolveUserPath } from "@/lib/clawdbot/paths";

type WorkspaceSettingsLike = {
  workspace?: {
    sandboxRootDir?: string;
    agentSchemaPath?: string;
  } | null;
};

export type StudioAgentSchemaSandbox = {
  mode?: "off" | "non-main" | "all";
  workspaceAccess?: "none" | "ro" | "rw";
};

export type StudioAgentSchemaEntry = {
  id: string;
  name: string;
  workspaceDir: string;
  sandbox?: StudioAgentSchemaSandbox;
};

const DEFAULT_SCHEMA_FILENAME = "agents.schema.json";
const SAFE_AGENT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const isPathWithinRoot = (rootDir: string, candidatePath: string) => {
  const relative = path.relative(rootDir, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const resolveSchemaWorkspaceDir = (rootDir: string, value: unknown, fallbackId: string) => {
  const raw = coerceString(value) || fallbackId;
  const resolved =
    path.isAbsolute(raw) || raw.startsWith("~")
      ? resolveUserPath(raw)
      : path.resolve(rootDir, raw);
  if (!isPathWithinRoot(rootDir, resolved)) {
    throw new Error(`Schema workspace path must stay inside sandbox root: ${raw}`);
  }
  return resolved;
};

const parseSandbox = (value: unknown): StudioAgentSchemaSandbox | undefined => {
  if (!isRecord(value)) return undefined;
  const modeRaw = coerceString(value.mode);
  const workspaceAccessRaw = coerceString(value.workspaceAccess);
  const mode =
    modeRaw === "off" || modeRaw === "non-main" || modeRaw === "all" ? modeRaw : undefined;
  const workspaceAccess =
    workspaceAccessRaw === "none" || workspaceAccessRaw === "ro" || workspaceAccessRaw === "rw"
      ? workspaceAccessRaw
      : undefined;
  if (!mode && !workspaceAccess) return undefined;
  return { ...(mode ? { mode } : {}), ...(workspaceAccess ? { workspaceAccess } : {}) };
};

export const resolveSandboxRootDir = (
  settings: WorkspaceSettingsLike,
  env: NodeJS.ProcessEnv = process.env
): string => {
  const configured = coerceString(settings.workspace?.sandboxRootDir);
  if (configured) return resolveUserPath(configured);
  return path.join(resolveStateDir(env), "sandboxes");
};

export const resolveAgentSchemaPath = (
  settings: WorkspaceSettingsLike,
  env: NodeJS.ProcessEnv = process.env
): { sandboxRootDir: string; schemaPath: string } => {
  const sandboxRootDir = resolveSandboxRootDir(settings, env);
  const raw = coerceString(settings.workspace?.agentSchemaPath) || DEFAULT_SCHEMA_FILENAME;
  const schemaPath =
    path.isAbsolute(raw) || raw.startsWith("~")
      ? resolveUserPath(raw)
      : path.resolve(sandboxRootDir, raw);
  if (!isPathWithinRoot(sandboxRootDir, schemaPath)) {
    throw new Error("Agent schema path must stay inside the sandbox workspace.");
  }
  return { sandboxRootDir, schemaPath };
};

export const parseAgentSchemaEntries = (
  raw: unknown,
  sandboxRootDir: string
): StudioAgentSchemaEntry[] => {
  if (!isRecord(raw)) {
    throw new Error("Agent schema must be a JSON object.");
  }
  const listRaw = Array.isArray(raw.agents) ? raw.agents : null;
  if (!listRaw) {
    throw new Error('Agent schema must include an "agents" array.');
  }
  const entries: StudioAgentSchemaEntry[] = [];
  for (const entryRaw of listRaw) {
    if (!isRecord(entryRaw)) continue;
    const id = coerceString(entryRaw.id);
    if (!SAFE_AGENT_ID_RE.test(id)) {
      throw new Error(`Invalid schema agent id: ${id || "(missing)"}`);
    }
    const name = coerceString(entryRaw.name) || id;
    const workspaceDir = resolveSchemaWorkspaceDir(
      sandboxRootDir,
      entryRaw.workspaceDir ?? entryRaw.workspace,
      id
    );
    const sandbox = parseSandbox(entryRaw.sandbox);
    entries.push({
      id,
      name,
      workspaceDir,
      ...(sandbox ? { sandbox } : {}),
    });
  }
  return entries;
};
