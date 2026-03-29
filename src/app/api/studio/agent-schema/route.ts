import fs from "node:fs";

import { NextResponse } from "next/server";

import { loadStudioSettings } from "@/lib/studio/settings-store";
import {
  parseAgentSchemaEntries,
  resolveAgentSchemaPath,
} from "@/lib/studio/workspace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = loadStudioSettings();
    const { sandboxRootDir, schemaPath } = resolveAgentSchemaPath(settings, process.env);
    if (!fs.existsSync(schemaPath)) {
      return NextResponse.json(
        {
          schemaPath,
          sandboxRootDir,
          exists: false,
          entries: [],
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const raw = fs.readFileSync(schemaPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const entries = parseAgentSchemaEntries(parsed, sandboxRootDir);
    return NextResponse.json(
      {
        schemaPath,
        sandboxRootDir,
        exists: true,
        entries,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load studio agent schema.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
