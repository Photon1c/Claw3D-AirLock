import fs from "node:fs";
import path from "node:path";

import {
  isSandboxMode,
  resolveSandboxDir,
  resolveStateDir,
  resolveUserPath,
} from "@/lib/clawdbot/paths";
import {
  defaultStudioSettings,
  mergeStudioSettings,
  normalizeStudioSettings,
  type StudioSettings,
  type StudioSettingsPatch,
} from "@/lib/studio/settings";

const SETTINGS_DIRNAME = "claw3d";
const SETTINGS_FILENAME = "settings.json";

export const resolveStudioSettingsPath = (env: NodeJS.ProcessEnv = process.env): string => {
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
  return path.join(base, SETTINGS_DIRNAME, SETTINGS_FILENAME);
};

const loadGatewayFromOpenClawConfig = (
  env: NodeJS.ProcessEnv = process.env,
): { url: string; token: string } | null => {
  const configPath = env.OPENCLAW_CONFIG_PATH?.trim();
  if (!configPath) return null;
  const resolved = resolveUserPath(configPath);
  if (!fs.existsSync(resolved)) return null;
  try {
    const raw = fs.readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const gateway = (parsed as Record<string, unknown>).gateway;
    if (!gateway || typeof gateway !== "object") return null;
    const gw = gateway as Record<string, unknown>;
    const url = typeof gw.url === "string" ? gw.url.trim() : "";
    const token = typeof gw.token === "string" ? gw.token.trim() : "";
    if (!url) return null;
    return { url, token };
  } catch {
    return null;
  }
};

export const loadStudioSettings = (env: NodeJS.ProcessEnv = process.env): StudioSettings => {
  const settingsPath = resolveStudioSettingsPath(env);
  const settings: StudioSettings = fs.existsSync(settingsPath)
    ? normalizeStudioSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")) as unknown)
    : defaultStudioSettings();

  if (isSandboxMode(env) && (!settings.gateway || !settings.gateway.url)) {
    const gwConfig = loadGatewayFromOpenClawConfig(env);
    if (gwConfig) {
      return normalizeStudioSettings({
        ...settings,
        gateway: gwConfig,
      });
    }
  }
  return settings;
};

export const saveStudioSettings = (
  next: StudioSettings,
  env: NodeJS.ProcessEnv = process.env
) => {
  const settingsPath = resolveStudioSettingsPath(env);
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), "utf8");
};

export const applyStudioSettingsPatch = (
  patch: StudioSettingsPatch,
  env: NodeJS.ProcessEnv = process.env
): StudioSettings => {
  const current = loadStudioSettings(env);
  const next = mergeStudioSettings(current, patch);
  saveStudioSettings(next, env);
  return next;
};
