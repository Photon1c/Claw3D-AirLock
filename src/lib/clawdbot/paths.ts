import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const resolveUserPath = (
  input: string,
  homedir: () => string = os.homedir
): string => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
};

const SANDBOX_STATE_DIRNAME = "claw3d_sandbox";

export const resolveSandboxDir = (): string => {
  return path.join(os.tmpdir(), SANDBOX_STATE_DIRNAME);
};

export const isSandboxMode = (env: NodeJS.ProcessEnv = process.env): boolean => {
  return (env.AIRLOCK_SANDBOX_MODE ?? env.CLAW3D_SANDBOX ?? "").trim().toLowerCase() === "1";
};

export const resolveStateDir = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string => {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, homedir);

  if (isSandboxMode(env)) {
    return resolveSandboxDir();
  }

  throw new Error(
    "OPENCLAW_STATE_DIR is not set. " +
      "Set it explicitly or enable sandbox mode with AIRLOCK_SANDBOX_MODE=1. " +
      "Sandbox mode uses an isolated temporary directory with no host-level state access."
  );
};

export const resolveConfigPathCandidates = (
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir
): string[] => {
  const explicit = env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit, homedir)];

  const stateDir = env.OPENCLAW_STATE_DIR?.trim();
  if (stateDir) {
    const resolved = resolveUserPath(stateDir, homedir);
    return [path.join(resolved, "claw3d", "settings.json")];
  }

  return [];
};
