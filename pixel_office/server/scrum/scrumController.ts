import * as fs from "fs";
import * as path from "path";
import {
  type ScrumSession,
  type ScrumStageResult,
  type ScrumStage,
  type CheckOutput,
  type ReportOutput,
  type ReviewOutput,
  type DecideOutput,
  type ExecuteOutput,
  type LogOutput,
} from "./types.js";

const SCRUM_LOG_DIR = path.resolve("data/scrum_logs");

if (!fs.existsSync(SCRUM_LOG_DIR)) {
  fs.mkdirSync(SCRUM_LOG_DIR, { recursive: true });
}

function generateSessionId(): string {
  return `scrum-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function createScrumSession(topic: string, participants: string[]): ScrumSession {
  return {
    id: generateSessionId(),
    timestamp: new Date().toISOString(),
    topic,
    participants,
    currentStage: "check",
    results: [],
    finalStatus: "pending",
  };
}

export function getNextStage(current: ScrumStage): ScrumStage | null {
  const stages: ScrumStage[] = ["check", "report", "review", "decide", "execute", "log"];
  const idx = stages.indexOf(current);
  return idx < stages.length - 1 ? stages[idx + 1] : null;
}

export function validateCheckOutput(output: unknown): output is CheckOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    typeof o.repo_status === "string" &&
    Array.isArray(o.findings) &&
    o.findings.every((f) => typeof f === "string")
  );
}

export function runCheckStage(session: ScrumSession): ScrumStageResult {
  const output: CheckOutput = {
    repo_status: "changes_detected",
    findings: [
      "2 modified files",
      "1 untracked file",
      "tests not yet run",
    ],
  };

  return {
    stage: "check",
    agent: "clerk",
    output,
    valid: validateCheckOutput(output),
  };
}

export function runReportStage(session: ScrumSession): ScrumStageResult {
  const checkResult = session.results.find((r) => r.stage === "check");
  const findings = checkResult && checkResult.valid
    ? (checkResult.output as CheckOutput).findings
    : ["Unable to retrieve findings"];

  const output: ReportOutput = {
    summary: `Repository status: ${findings.join("; ")}.`,
    from_stage: "check",
  };

  return {
    stage: "report",
    agent: "clerk",
    output,
    valid: typeof output.summary === "string",
  };
}

export function runReviewStage(session: ScrumSession): ScrumStageResult {
  const checkResult = session.results.find((r) => r.stage === "check");
  const hasUnrunTests = checkResult?.valid &&
    (checkResult.output as CheckOutput).findings.includes("tests not yet run");

  const output: ReviewOutput = {
    approved: !hasUnrunTests,
    risks: hasUnrunTests ? ["tests not run"] : [],
    recommended_actions: hasUnrunTests ? ["run tests", "review modified files"] : [],
  };

  return {
    stage: "review",
    agent: "specialist",
    output,
    valid: typeof output.approved === "boolean",
  };
}

export function runDecideStage(session: ScrumSession): ScrumStageResult {
  const reviewResult = session.results.find((r) => r.stage === "review");
  const approved = reviewResult?.valid ? (reviewResult.output as ReviewOutput).approved : false;

  const decision = approved ? "implement" : "escalate";
  const output: DecideOutput = {
    decision,
    rationale: approved
      ? "Review approved, proceeding to implementation."
      : "Risks identified, escalating for further review.",
  };

  return {
    stage: "decide",
    agent: "executive",
    output,
    valid: ["implement", "defer", "escalate", "close"].includes(decision),
  };
}

export function runExecuteStage(session: ScrumSession): ScrumStageResult {
  const decideResult = session.results.find((r) => r.stage === "decide");
  const decision = decideResult?.valid
    ? (decideResult.output as DecideOutput).decision
    : "skipped";

  const output: ExecuteOutput = {
    action: decision === "implement" ? "prepare_implementation" : decision,
    status: decision === "implement" ? "mock_complete" : "skipped",
  };

  return {
    stage: "execute",
    agent: "clerk",
    output,
    valid: typeof output.status === "string",
  };
}

export function runLogStage(session: ScrumSession): ScrumStageResult {
  const logContent = generateSessionMarkdown(session);
  const logPath = path.join(SCRUM_LOG_DIR, `${session.id}.md`);

  try {
    fs.writeFileSync(logPath, logContent, "utf8");
  } catch {
    const output: LogOutput = { logged: false, path: "" };
    return {
      stage: "log",
      agent: "archivist",
      output,
      valid: false,
      error: "Failed to write log file",
    };
  }

  // If this is a self-maintenance topic, append GitHub-ready summary
  if (session.topic && session.topic.startsWith("repo:")) {
    appendToGithubNotes(session);
  }

  const output: LogOutput = { logged: true, path: logPath };
  return {
    stage: "log",
    agent: "archivist",
    output,
    valid: true,
  };
}

function appendToGithubNotes(session: ScrumSession): void {
  const notesPath = path.resolve("docs/PIXEL_OFFICE_SCRUM_NOTES.md");
  const githubSummary = generateGithubSummary(session);
  
  try {
    const marker = "<!-- New entries are appended below this line. Do not edit existing entries. -->";
    let content = "";
    
    if (fs.existsSync(notesPath)) {
      content = fs.readFileSync(notesPath, "utf8");
    }
    
    const entry = `\n${githubSummary}\n`;
    
    if (content.includes(marker)) {
      content = content.replace(marker, `${marker}\n${entry}`);
    } else {
      content += entry;
    }
    
    fs.writeFileSync(notesPath, content, "utf8");
  } catch (error) {
    console.error("Failed to append to GitHub notes:", error);
  }
}

function generateGithubSummary(session: ScrumSession): string {
  const date = new Date(session.timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  
  const decision = session.results.find(r => r.stage === "decide")?.output as DecideOutput | undefined;
  const review = session.results.find(r => r.stage === "review")?.output as ReviewOutput | undefined;
  const check = session.results.find(r => r.stage === "check")?.output as CheckOutput | undefined;
  
  const lines = [
    `## ${date} — ${session.topic}`,
    "",
    `**Session ID:** ${session.id}`,
    `**Status:** ${session.finalStatus}`,
    "",
  ];
  
  if (check && check.findings) {
    lines.push("### Observations");
    check.findings.forEach(f => lines.push(`- ${f}`));
    lines.push("");
  }
  
  if (review && review.risks) {
    lines.push("### Risks Identified");
    review.risks.forEach(r => lines.push(`- ${r}`));
    lines.push("");
  }
  
  if (review && review.recommended_actions) {
    lines.push("### Recommended Actions");
    review.recommended_actions.forEach(a => lines.push(`- ${a}`));
    lines.push("");
  }
  
  if (decision) {
    lines.push(`**Decision:** ${decision.decision.toUpperCase()}`);
    lines.push(`**Rationale:** ${decision.rationale}`);
    lines.push("");
  }
  
  lines.push("---");
  
  return lines.join("\n");
}

function generateSessionMarkdown(session: ScrumSession): string {
  const lines = [
    `# SCRUM Session: ${session.id}`,
    "",
    `**Timestamp:** ${session.timestamp}`,
    `**Topic:** ${session.topic}`,
    `**Participants:** ${session.participants.join(", ")}`,
    "",
    "## Stages",
    "",
  ];

  for (const result of session.results) {
    lines.push(`### ${result.stage.toUpperCase()}`);
    lines.push(`- **Agent:** ${result.agent}`);
    lines.push(`- **Valid:** ${result.valid ? "Yes" : "No"}`);
    if (result.error) {
      lines.push(`- **Error:** ${result.error}`);
    }
    lines.push(`- **Output:**`);
    lines.push("```json");
    lines.push(JSON.stringify(result.output, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Summary");
  const finalDecision = session.results.find((r) => r.stage === "decide")?.output as DecideOutput | undefined;
  if (finalDecision) {
    lines.push(`- **Decision:** ${finalDecision.decision}`);
    lines.push(`- **Rationale:** ${finalDecision.rationale}`);
  }
  lines.push(`- **Final Status:** ${session.finalStatus}`);

  return lines.join("\n");
}

export function advanceScrumSession(
  session: ScrumSession
): { session: ScrumSession; stageResult: ScrumStageResult } {
  const stageHandlers: Record<ScrumStage, (s: ScrumSession) => ScrumStageResult> = {
    check: runCheckStage,
    report: runReportStage,
    review: runReviewStage,
    decide: runDecideStage,
    execute: runExecuteStage,
    log: runLogStage,
  };

  const handler = stageHandlers[session.currentStage];
  if (!handler) {
    session.finalStatus = "failed";
    return {
      session,
      stageResult: {
        stage: session.currentStage,
        agent: "system",
        output: {} as LogOutput,
        valid: false,
        error: "Unknown stage",
      },
    };
  }

  const stageResult = handler(session);
  session.results.push(stageResult);

  if (!stageResult.valid) {
    session.finalStatus = "failed";
    return { session, stageResult };
  }

  const nextStage = getNextStage(session.currentStage);
  if (nextStage) {
    session.currentStage = nextStage;
  } else {
    session.finalStatus = "complete";
  }

  return { session, stageResult };
}
