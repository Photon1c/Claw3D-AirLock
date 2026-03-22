// @vitest-environment node

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("studio setup paths", () => {
  it("resolves settings path under OPENCLAW_STATE_DIR when set", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const settingsPath = resolveStudioSettingsPath({
      OPENCLAW_STATE_DIR: "/tmp/openclaw-state",
    } as unknown as NodeJS.ProcessEnv);
    expect(settingsPath).toBe("/tmp/openclaw-state/claw3d/settings.json");
  });

  it("resolves settings path under ~/.claw3d when legacy dirs are absent", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "studio-home-"));
    const priorHome = process.env.HOME;
    process.env.HOME = tempHome;
    const settingsPath = resolveStudioSettingsPath({} as NodeJS.ProcessEnv);
    try {
      expect(settingsPath).toBe(path.join(tempHome, ".claw3d", "claw3d", "settings.json"));
    } finally {
      if (priorHome === undefined) delete process.env.HOME;
      else process.env.HOME = priorHome;
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("falls back to ~/.openclaw when preferred dir is missing but legacy exists", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "studio-home-"));
    const priorHome = process.env.HOME;
    process.env.HOME = tempHome;
    fs.mkdirSync(path.join(tempHome, ".openclaw"), { recursive: true });
    const settingsPath = resolveStudioSettingsPath({} as NodeJS.ProcessEnv);
    try {
      expect(settingsPath).toBe(path.join(tempHome, ".openclaw", "claw3d", "settings.json"));
    } finally {
      if (priorHome === undefined) delete process.env.HOME;
      else process.env.HOME = priorHome;
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
