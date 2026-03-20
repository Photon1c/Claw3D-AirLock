import fs from "node:fs";
import path from "node:path";

import {
  isSandboxMode,
  resolveSandboxDir,
  resolveStateDir,
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
  const base = isSandboxMode(env)
    ? resolveSandboxDir()
    : resolveStateDir(env);
  return path.join(base, SETTINGS_DIRNAME, SETTINGS_FILENAME);
};

export const loadStudioSettings = (env: NodeJS.ProcessEnv = process.env): StudioSettings => {
  const settingsPath = resolveStudioSettingsPath(env);
  if (!fs.existsSync(settingsPath)) {
    return defaultStudioSettings();
  }
  const raw = fs.readFileSync(settingsPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return normalizeStudioSettings(parsed);
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
