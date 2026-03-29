import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  generateScrumReport,
  previewScrumReport,
  writeScrumReport,
  exportScrumReport,
  isSessionComplete,
  loadScrumSession,
  exportLatestCompletedScrum,
  type ScrumReportResult,
} from "../scrumExporter";
import type { ScrumSession } from "../types";

function createMockSession(overrides: Partial<ScrumSession> = {}): ScrumSession {
  return {
    id: "scrum-test-12345-abc",
    timestamp: "2026-03-19T10:00:00.000Z",
    topic: "Test Standup",
    participants: ["clerk", "specialist", "executive", "archivist"],
    currentStage: "log",
    finalStatus: "complete",
    results: [
      {
        stage: "check",
        agent: "clerk",
        valid: true,
        output: {
          repo_status: "changes_detected",
          findings: ["2 modified files", "1 untracked file"],
        },
      },
      {
        stage: "report",
        agent: "clerk",
        valid: true,
        output: {
          summary: "Repository has pending changes that need review.",
          from_stage: "check",
        },
      },
      {
        stage: "review",
        agent: "specialist",
        valid: true,
        output: {
          approved: true,
          risks: [],
          recommended_actions: ["proceed with implementation"],
        },
      },
      {
        stage: "decide",
        agent: "executive",
        valid: true,
        output: {
          decision: "implement",
          rationale: "Review approved, proceeding to implementation.",
        },
      },
      {
        stage: "execute",
        agent: "clerk",
        valid: true,
        output: {
          action: "prepare_implementation",
          status: "mock_complete",
        },
      },
      {
        stage: "log",
        agent: "archivist",
        valid: true,
        output: {
          logged: true,
          path: "data/scrum_logs/scrum-test-12345-abc.md",
        },
      },
    ],
    ...overrides,
  };
}

describe("generateScrumReport", () => {
  it("generates a report with all required sections", () => {
    const session = createMockSession();
    const report = generateScrumReport(session);

    assert.ok(report.includes("# SCRUM Report: Test Standup"));
    assert.ok(report.includes("## Metadata"));
    assert.ok(report.includes("## CHECK"));
    assert.ok(report.includes("## REPORT"));
    assert.ok(report.includes("## REVIEW"));
    assert.ok(report.includes("## DECIDE"));
    assert.ok(report.includes("## EXECUTE"));
    assert.ok(report.includes("## LOG"));
    assert.ok(report.includes("## Summary"));
  });

  it("includes session metadata", () => {
    const session = createMockSession();
    const report = generateScrumReport(session);

    assert.ok(report.includes(`**Session ID:** ${session.id}`));
    assert.ok(report.includes("**Topic:** Test Standup"));
    assert.ok(report.includes("clerk, specialist, executive, archivist"));
    assert.ok(report.includes("**Final Status:** complete"));
  });

  it("includes check stage findings", () => {
    const session = createMockSession();
    const report = generateScrumReport(session);

    assert.ok(report.includes("**Findings:**"));
    assert.ok(report.includes("- 2 modified files"));
    assert.ok(report.includes("- 1 untracked file"));
  });

  it("includes review decisions and actions", () => {
    const session = createMockSession();
    const report = generateScrumReport(session);

    assert.ok(report.includes("**Approved:** Yes"));
    assert.ok(report.includes("- proceed with implementation"));
  });

  it("includes decide stage decision", () => {
    const session = createMockSession();
    const report = generateScrumReport(session);

    assert.ok(report.includes("**Decision:** IMPLEMENT"));
    assert.ok(report.includes("**Rationale:** Review approved, proceeding to implementation."));
  });

  it("includes execute stage status", () => {
    const session = createMockSession();
    const report = generateScrumReport(session);

    assert.ok(report.includes("**Action:** prepare_implementation"));
    assert.ok(report.includes("**Status:** mock_complete"));
  });

  it("is deterministic - same session produces same report", () => {
    const session = createMockSession();
    const report1 = generateScrumReport(session);
    const report2 = generateScrumReport(session);

    assert.equal(report1, report2);
  });

  it("handles empty participants", () => {
    const session = createMockSession({ participants: [] });
    const report = generateScrumReport(session);

    assert.ok(report.includes("**Participants:** none"));
  });

  it("handles incomplete session with missing stages", () => {
    const fullSession = createMockSession();
    const session = createMockSession({
      results: fullSession.results.slice(0, 3),
      finalStatus: "pending",
    });
    const report = generateScrumReport(session);

    assert.ok(report.includes("## CHECK"));
    assert.ok(report.includes("## REPORT"));
    assert.ok(report.includes("## REVIEW"));
    assert.ok(!report.includes("## DECIDE"));
    assert.ok(!report.includes("## EXECUTE"));
    assert.ok(!report.includes("## LOG"));
  });

  it("handles session with risks", () => {
    const fullSession = createMockSession();
    const session = createMockSession({
      results: fullSession.results.map((r) =>
        r.stage === "review"
          ? { ...r, output: { ...r.output, approved: false, risks: ["tests not run"] } }
          : r
      ),
    });
    const report = generateScrumReport(session);

    assert.ok(report.includes("**Approved:** No"));
    assert.ok(report.includes("**Risks:**"));
    assert.ok(report.includes("- tests not run"));
  });
});

describe("previewScrumReport", () => {
  it("returns same content as generateScrumReport", () => {
    const session = createMockSession();
    const preview = previewScrumReport(session);
    const report = generateScrumReport(session);

    assert.equal(preview, report);
  });
});

describe("isSessionComplete", () => {
  it("returns true for complete session", () => {
    const session = createMockSession();
    assert.equal(isSessionComplete(session), true);
  });

  it("returns false for pending session", () => {
    const session = createMockSession({ finalStatus: "pending" });
    assert.equal(isSessionComplete(session), false);
  });

  it("returns false for failed session", () => {
    const session = createMockSession({ finalStatus: "failed" });
    assert.equal(isSessionComplete(session), false);
  });

  it("returns false when LOG stage is missing", () => {
    const fullSession = createMockSession();
    const session = createMockSession({
      results: fullSession.results.filter((r) => r.stage !== "log"),
    });
    assert.equal(isSessionComplete(session), false);
  });

  it("returns false when LOG stage is invalid", () => {
    const fullSession = createMockSession();
    const session = createMockSession({
      results: fullSession.results.map((r) =>
        r.stage === "log" ? { ...r, valid: false } : r
      ),
    });
    assert.equal(isSessionComplete(session), false);
  });
});

describe("writeScrumReport", () => {
  const testDir = path.join(process.cwd(), "test-reports-temp");
  const testSession = createMockSession({
    timestamp: "2026-03-19T10:00:00.000Z",
  });

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("writes report to correct path", async () => {
    const reportPath = await writeScrumReport(testSession, testDir);

    const expectedFilename = "2026-03-19_scrum-scrum-test-12345-abc.md";
    assert.ok(reportPath.endsWith(expectedFilename));
  });

  it("creates directory if it does not exist", async () => {
    const nestedDir = path.join(testDir, "nested", "reports");
    const reportPath = await writeScrumReport(testSession, nestedDir);

    assert.ok(fs.existsSync(nestedDir));
    assert.ok(fs.existsSync(reportPath));
  });

  it("writes correct content", async () => {
    await writeScrumReport(testSession, testDir);

    const expectedFilename = "2026-03-19_scrum-scrum-test-12345-abc.md";
    const reportPath = path.join(testDir, expectedFilename);
    const content = fs.readFileSync(reportPath, "utf8");

    assert.ok(content.includes("# SCRUM Report: Test Standup"));
    assert.ok(content.includes(testSession.id));
  });

  it("overwrites existing file with same session", async () => {
    await writeScrumReport(testSession, testDir);
    await writeScrumReport(testSession, testDir);

    const expectedFilename = "2026-03-19_scrum-scrum-test-12345-abc.md";
    const reportPath = path.join(testDir, expectedFilename);

    const files = fs.readdirSync(testDir);
    assert.equal(files.filter((f) => f.includes(testSession.id)).length, 1);
  });
});

describe("exportScrumReport", () => {
  const testDir = path.join(process.cwd(), "test-reports-temp");
  const testSession = createMockSession();

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    const logDir = path.join(process.cwd(), "data", "scrum_logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logContent = `# SCRUM Session: ${testSession.id}

\`\`\`json
${JSON.stringify(testSession, null, 2)}
\`\`\`
`;
    fs.writeFileSync(path.join(logDir, `${testSession.id}.md`), logContent, "utf8");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    const logPath = path.join(process.cwd(), "data", "scrum_logs", `${testSession.id}.md`);
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  });

  it("exports a completed session", async () => {
    const result = await exportScrumReport(testSession.id, testDir);

    assert.equal(result.sessionId, testSession.id);
    assert.ok(result.path.includes(testSession.id));
    assert.ok(fs.existsSync(result.path));
  });

  it("throws for non-existent session", async () => {
    await assert.rejects(
      () => exportScrumReport("non-existent-session", testDir),
      (error: any) => {
        assert.equal(error.code, "SESSION_NOT_FOUND");
        return true;
      }
    );
  });

  it("throws for incomplete session", async () => {
    const incompleteSession = createMockSession({ finalStatus: "pending" });
    const logDir = path.join(process.cwd(), "data", "scrum_logs");
    const logContent = `# SCRUM Session: ${incompleteSession.id}

\`\`\`json
${JSON.stringify(incompleteSession, null, 2)}
\`\`\`
`;
    fs.writeFileSync(
      path.join(logDir, `${incompleteSession.id}.md`),
      logContent,
      "utf8"
    );

    try {
      await assert.rejects(
        () => exportScrumReport(incompleteSession.id, testDir),
        (error: any) => {
          assert.equal(error.code, "INCOMPLETE_SESSION");
          return true;
        }
      );
    } finally {
      fs.unlinkSync(path.join(logDir, `${incompleteSession.id}.md`));
    }
  });
});

describe("loadScrumSession", () => {
  const testSession = createMockSession();

  beforeEach(() => {
    const logDir = path.join(process.cwd(), "data", "scrum_logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logContent = `# SCRUM Session: ${testSession.id}

\`\`\`json
${JSON.stringify(testSession, null, 2)}
\`\`\`
`;
    fs.writeFileSync(path.join(logDir, `${testSession.id}.md`), logContent, "utf8");
  });

  afterEach(() => {
    const logPath = path.join(process.cwd(), "data", "scrum_logs", `${testSession.id}.md`);
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  });

  it("loads an existing session", async () => {
    const loaded = await loadScrumSession(testSession.id);

    assert.ok(loaded);
    assert.equal(loaded!.id, testSession.id);
    assert.equal(loaded!.topic, testSession.topic);
  });

  it("returns null for non-existent session", async () => {
    const loaded = await loadScrumSession("non-existent-session");
    assert.equal(loaded, null);
  });
});
