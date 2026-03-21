const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const resolveUserPath = (input) => {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
};

const SANDBOX_STATE_DIRNAME = "claw3d_sandbox";

const resolveSandboxDir = () => {
  return path.join(os.tmpdir(), SANDBOX_STATE_DIRNAME);
};

const isSandboxMode = (env = process.env) => {
  return (env.AIRLOCK_SANDBOX_MODE ?? env.CLAW3D_SANDBOX ?? "").trim().toLowerCase() === "1";
};

const resolveStateDir = (env = process.env) => {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);

  if (isSandboxMode(env)) {
    return resolveSandboxDir();
  }

  throw new Error(
    "OPENCLAW_STATE_DIR is not set. " +
      "Set it explicitly or enable sandbox mode with AIRLOCK_SANDBOX_MODE=1. " +
      "Sandbox mode uses an isolated temporary directory with no host-level state access."
  );
};

const resolveStudioSettingsPath = (env = process.env) => {
  const configPath = env.OPENCLAW_CONFIG_PATH?.trim();
  if (isSandboxMode(env) && configPath) {
    const resolved = resolveUserPath(configPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  const base = isSandboxMode(env)
    ? resolveSandboxDir()
    : resolveStateDir(env);
  return path.join(base, "claw3d", "settings.json");
};

const readJsonFile = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const DEFAULT_GATEWAY_URL = "ws://localhost:18789";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const isRecord = (value) => Boolean(value && typeof value === "object");

const isLocalGatewayUrl = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const loadUpstreamGatewaySettings = (env = process.env) => {
  const settingsPath = resolveStudioSettingsPath(env);
  const parsed = readJsonFile(settingsPath);
  const gateway = parsed && typeof parsed === "object" ? parsed.gateway : null;
  const url = typeof gateway?.url === "string" ? gateway.url.trim() : "";
  const token = typeof gateway?.token === "string" ? gateway.token.trim() : "";
  return {
    url: url || DEFAULT_GATEWAY_URL,
    token,
    settingsPath,
  };
};

module.exports = {
  resolveStateDir,
  resolveStudioSettingsPath,
  loadUpstreamGatewaySettings,
};
