import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/studio/agent-schema/route";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeStudioSettings = (stateDir: string, value: Record<string, unknown>) => {
  const settingsDir = path.join(stateDir, "claw3d");
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(path.join(settingsDir, "settings.json"), JSON.stringify(value, null, 2), "utf8");
};

describe("studio agent schema route", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("returns empty entries when schema file does not exist", async () => {
    tempDir = makeTempDir("studio-agent-schema-empty");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    writeStudioSettings(tempDir, { version: 1, gateway: null });

    const response = await GET();
    const body = (await response.json()) as {
      exists?: boolean;
      entries?: unknown[];
      sandboxRootDir?: string;
    };
    expect(response.status).toBe(200);
    expect(body.exists).toBe(false);
    expect(body.entries).toEqual([]);
    expect(typeof body.sandboxRootDir).toBe("string");
  });

  it("loads and validates schema entries inside sandbox root", async () => {
    tempDir = makeTempDir("studio-agent-schema-valid");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    const sandboxRoot = path.join(tempDir, "sandbox");
    fs.mkdirSync(sandboxRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sandboxRoot, "agents.schema.json"),
      JSON.stringify(
        {
          agents: [
            {
              id: "builder",
              name: "Builder",
              workspaceDir: "builder",
              sandbox: { mode: "non-main", workspaceAccess: "rw" },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    writeStudioSettings(tempDir, {
      version: 1,
      gateway: null,
      workspace: {
        sandboxRootDir: sandboxRoot,
        agentSchemaPath: "agents.schema.json",
      },
    });

    const response = await GET();
    const body = (await response.json()) as {
      exists?: boolean;
      entries?: Array<{ id?: string; workspaceDir?: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.entries?.[0]?.id).toBe("builder");
    expect(body.entries?.[0]?.workspaceDir).toBe(path.join(sandboxRoot, "builder"));
  });

  it("rejects schema paths outside sandbox root", async () => {
    tempDir = makeTempDir("studio-agent-schema-outside");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    const sandboxRoot = path.join(tempDir, "sandbox");
    fs.mkdirSync(sandboxRoot, { recursive: true });
    writeStudioSettings(tempDir, {
      version: 1,
      gateway: null,
      workspace: {
        sandboxRootDir: sandboxRoot,
        agentSchemaPath: "../outside.json",
      },
    });

    const response = await GET();
    const body = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/sandbox workspace/i);
  });
});
