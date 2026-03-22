import * as fs from "fs";
import * as path from "path";
import {
  type ScrumSession,
  type ScrumStageResult,
  type CheckOutput,
  type ReportOutput,
  type ReviewOutput,
  type DecideOutput,
  type ExecuteOutput,
} from "./types.js";

const SCRUM_REPORT_DIR = "docs/reports";
const SCRUM_NOTES_PATH = "docs/PIXEL_OFFICE_SCRUM_NOTES.md";

export type ExportMode = "preview" | "localReport" | "localNotes" | "githubReport" | "githubNotes";

export interface ScrumReportResult {
  path: string;
  sessionId: string;
  timestamp: string;
  localSuccess: boolean;
  githubSuccess?: boolean;
  githubUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface ScrumReportError {
  error: string;
  code: "SESSION_NOT_FOUND" | "INCOMPLETE_SESSION" | "WRITE_ERROR" | "INVALID_SESSION" | "GITHUB_NOT_CONFIGURED" | "EXPORT_ERROR";
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().split("T")[0];
}

function formatStageSection(result: ScrumStageResult): string[] {
  const lines: string[] = [];

  switch (result.stage) {
    case "check": {
      const output = result.output as CheckOutput;
      lines.push(`**Status:** ${output.repo_status}`);
      if (output.findings.length > 0) {
        lines.push("");
        lines.push("**Findings:**");
        output.findings.forEach((f) => lines.push(`- ${f}`));
      }
      break;
    }
    case "report": {
      const output = result.output as ReportOutput;
      lines.push(`**Summary:** ${output.summary}`);
      break;
    }
    case "review": {
      const output = result.output as ReviewOutput;
      lines.push(`**Approved:** ${output.approved ? "Yes" : "No"}`);
      if (output.risks.length > 0) {
        lines.push("");
        lines.push("**Risks:**");
        output.risks.forEach((r) => lines.push(`- ${r}`));
      }
      if (output.recommended_actions.length > 0) {
        lines.push("");
        lines.push("**Recommended Actions:**");
        output.recommended_actions.forEach((a) => lines.push(`- ${a}`));
      }
      break;
    }
    case "decide": {
      const output = result.output as DecideOutput;
      lines.push(`**Decision:** ${output.decision.toUpperCase()}`);
      lines.push(`**Rationale:** ${output.rationale}`);
      break;
    }
    case "execute": {
      const output = result.output as ExecuteOutput;
      lines.push(`**Action:** ${output.action}`);
      lines.push(`**Status:** ${output.status}`);
      break;
    }
    case "log": {
      lines.push("Session log written successfully.");
      break;
    }
  }

  if (result.error) {
    lines.push("");
    lines.push(`**Error:** ${result.error}`);
  }

  return lines;
}

export function generateScrumReport(session: ScrumSession): string {
  const lines: string[] = [];

  lines.push(`# SCRUM Report: ${session.topic}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Session ID:** ${session.id}`);
  lines.push(`- **Date:** ${formatDate(session.timestamp)}`);
  lines.push(`- **Topic:** ${session.topic}`);
  lines.push(`- **Participants:** ${session.participants.join(", ") || "none"}`);
  lines.push(`- **Final Status:** ${session.finalStatus}`);
  lines.push("");

  const stageOrder: ScrumStageResult["stage"][] = ["check", "report", "review", "decide", "execute", "log"];
  const resultsByStage = new Map(session.results.map((r) => [r.stage, r]));

  for (const stage of stageOrder) {
    const result = resultsByStage.get(stage);
    if (!result) continue;

    lines.push("---");
    lines.push("");
    lines.push(`## ${stage.toUpperCase()}`);
    lines.push("");
    lines.push(`*Agent: ${result.agent}*`);
    lines.push("");

    const sectionLines = formatStageSection(result);
    lines.push(...sectionLines);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Summary");

  const decision = (session.results.find((r) => r.stage === "decide")?.output as DecideOutput | undefined);
  const review = (session.results.find((r) => r.stage === "review")?.output as ReviewOutput | undefined);

  lines.push("");
  if (decision) {
    lines.push(`- **Decision:** ${decision.decision.toUpperCase()}`);
    lines.push(`- **Rationale:** ${decision.rationale}`);
  }
  if (review && review.recommended_actions.length > 0) {
    lines.push("");
    lines.push("- **Next Actions:**");
    review.recommended_actions.forEach((a) => lines.push(`  - ${a}`));
  }
  lines.push("");
  lines.push(`- **Session Status:** ${session.finalStatus}`);
  lines.push("");

  return lines.join("\n");
}

export function previewScrumReport(session: ScrumSession): string {
  return generateScrumReport(session);
}

export function generateGithubNotes(session: ScrumSession): string {
  const date = formatDate(session.timestamp);
  
  const decision = session.results.find(r => r.stage === "decide")?.output as DecideOutput | undefined;
  const review = session.results.find(r => r.stage === "review")?.output as ReviewOutput | undefined;
  const check = session.results.find(r => r.stage === "check")?.output as CheckOutput | undefined;
  
  const lines: string[] = [
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

export async function appendToGithubNotes(session: ScrumSession, basePath: string = SCRUM_NOTES_PATH): Promise<string> {
  const notesPath = path.resolve(basePath);
  const notesEntry = generateGithubNotes(session);
  
  try {
    let content = "";
    
    if (fs.existsSync(notesPath)) {
      content = fs.readFileSync(notesPath, "utf8");
    }
    
    const marker = "<!-- New entries are appended below this line. Do not edit existing entries. -->";
    
    if (content.includes(marker)) {
      content = content.replace(marker, `${marker}\n\n${notesEntry}`);
    } else {
      if (content) {
        content += "\n\n";
      }
      content += notesEntry;
    }
    
    ensureDirectoryExists(path.dirname(notesPath));
    fs.writeFileSync(notesPath, content, "utf8");
    
    return notesPath;
  } catch (error) {
    throw new Error(`Failed to append notes: ${error}`);
  }
}

function resolveReportPath(session: ScrumSession, baseDir: string): string {
  const dateStr = formatShortDate(session.timestamp);
  const filename = `${dateStr}_scrum-${session.id}.md`;
  return path.resolve(baseDir, filename);
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isSessionComplete(session: ScrumSession): boolean {
  const hasLogStage = session.results.some((r) => r.stage === "log");
  const logStageValid = session.results.find((r) => r.stage === "log")?.valid === true;
  return hasLogStage && logStageValid && session.finalStatus === "complete";
}

export function loadScrumSession(sessionId: string): Promise<ScrumSession | null> {
  return new Promise((resolve) => {
    const sessionPath = path.resolve("data/scrum_logs", `${sessionId}.md`);
    if (!fs.existsSync(sessionPath)) {
      resolve(null);
      return;
    }

    try {
      const content = fs.readFileSync(sessionPath, "utf8");
      const frontMatterMatch = content.match(/^```json\n([\s\S]*?)\n```$/m);
      if (!frontMatterMatch) {
        resolve(null);
        return;
      }

      const session = JSON.parse(frontMatterMatch[1]) as ScrumSession;
      resolve(session);
    } catch {
      resolve(null);
    }
  });
}

export async function writeScrumReport(
  session: ScrumSession,
  baseDir: string = SCRUM_REPORT_DIR
): Promise<string> {
  const reportPath = resolveReportPath(session, baseDir);
  const reportContent = generateScrumReport(session);

  try {
    ensureDirectoryExists(path.dirname(reportPath));
    fs.writeFileSync(reportPath, reportContent, "utf8");
  } catch (error) {
    throw new Error(`Failed to write report to ${reportPath}: ${error}`);
  }

  return reportPath;
}

export async function exportScrumReport(
  sessionId: string,
  modeOrBaseDir: ExportMode | string = "localReport",
  githubClient?: { pushReport: (path: string, msg: string) => Promise<{ success: boolean; url?: string; error?: string }>; pushNotes: (content: string, msg: string) => Promise<{ success: boolean; url?: string; error?: string }> },
  baseDir?: string
): Promise<ScrumReportResult> {
  const session = await loadScrumSession(sessionId);

  if (!session) {
    throw { error: "Session not found", code: "SESSION_NOT_FOUND" } as ScrumReportError;
  }

  if (!isSessionComplete(session)) {
    throw { error: "Session is not complete (LOG stage not reached)", code: "INCOMPLETE_SESSION" } as ScrumReportError;
  }

  const isOldSignature = !["preview", "localReport", "localNotes", "githubReport", "githubNotes"].includes(modeOrBaseDir);
  const mode: ExportMode = isOldSignature ? "localReport" : modeOrBaseDir as ExportMode;
  const effectiveBaseDir = isOldSignature ? modeOrBaseDir : baseDir;

  const result: ScrumReportResult = {
    path: "",
    sessionId: session.id,
    timestamp: new Date().toISOString(),
    localSuccess: false,
  };

  if (mode === "preview") {
    result.path = "preview";
    result.localSuccess = true;
    return result;
  }

  if (mode === "localReport" || mode === "githubReport") {
    try {
      const reportPath = await writeScrumReport(session, effectiveBaseDir);
      result.path = reportPath;
      result.localSuccess = true;

      if (mode === "githubReport" && githubClient) {
        const githubResult = await githubClient.pushReport(
          reportPath,
          `SCRUM Report: ${session.topic} (${session.id})`
        );
        result.githubSuccess = githubResult.success;
        result.githubUrl = githubResult.url;
        if (!githubResult.success) {
          result.error = githubResult.error;
        }
      }
    } catch (error: any) {
      result.error = error.message;
      result.errorCode = "WRITE_ERROR";
    }
  }

  if (mode === "localNotes" || mode === "githubNotes") {
    try {
      const notesPath = await appendToGithubNotes(session);
      result.path = notesPath;
      result.localSuccess = true;

      if (mode === "githubNotes" && githubClient) {
        const notesContent = generateGithubNotes(session);
        const githubResult = await githubClient.pushNotes(
          notesContent,
          `SCRUM Notes: ${session.topic} (${session.id})`
        );
        result.githubSuccess = githubResult.success;
        result.githubUrl = githubResult.url;
        if (!githubResult.success) {
          result.error = githubResult.error;
        }
      }
    } catch (error: any) {
      result.error = error.message;
      result.errorCode = "WRITE_ERROR";
    }
  }

  return result;
}

export async function exportLatestCompletedScrum(
  mode: ExportMode = "localReport",
  githubClient?: { pushReport: (path: string, msg: string) => Promise<{ success: boolean; url?: string; error?: string }>; pushNotes: (content: string, msg: string) => Promise<{ success: boolean; url?: string; error?: string }> }
): Promise<ScrumReportResult> {
  const logDir = path.resolve("data/scrum_logs");

  if (!fs.existsSync(logDir)) {
    throw { error: "No scrum logs directory found", code: "SESSION_NOT_FOUND" } as ScrumReportError;
  }

  const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".md"));

  let latestSession: ScrumSession | null = null;
  let latestTimestamp = 0;

  for (const file of files) {
    const sessionPath = path.join(logDir, file);
    try {
      const content = fs.readFileSync(sessionPath, "utf8");
      const frontMatterMatch = content.match(/^```json\n([\s\S]*?)\n```$/m);
      if (!frontMatterMatch) continue;

      const session = JSON.parse(frontMatterMatch[1]) as ScrumSession;
      if (isSessionComplete(session)) {
        const sessionTime = new Date(session.timestamp).getTime();
        if (sessionTime > latestTimestamp) {
          latestTimestamp = sessionTime;
          latestSession = session;
        }
      }
    } catch {
      continue;
    }
  }

  if (!latestSession) {
    throw { error: "No completed SCRUM sessions found", code: "SESSION_NOT_FOUND" } as ScrumReportError;
  }

  return exportScrumReport(latestSession.id, mode, githubClient);
}

export function getGitHubConfigured(): boolean {
  return !!(
    process.env.GITHUB_TOKEN &&
    process.env.SAFE_SCRUM_REPO
  );
}
