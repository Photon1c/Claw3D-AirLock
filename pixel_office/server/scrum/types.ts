export type ScrumStage = "check" | "report" | "review" | "decide" | "execute" | "log";

export interface CheckOutput {
  repo_status: "clean" | "changes_detected" | "error";
  findings: string[];
}

export interface ReportOutput {
  summary: string;
  from_stage: "check";
}

export interface ReviewOutput {
  approved: boolean;
  risks: string[];
  recommended_actions: string[];
}

export type Decision = "implement" | "defer" | "escalate" | "close";

export interface DecideOutput {
  decision: Decision;
  rationale: string;
}

export interface ExecuteOutput {
  action: string;
  status: "mock_complete" | "mock_failed" | "skipped";
}

export interface LogOutput {
  logged: boolean;
  path: string;
}

export type StageOutput = CheckOutput | ReportOutput | ReviewOutput | DecideOutput | ExecuteOutput | LogOutput;

export interface ScrumStageResult {
  stage: ScrumStage;
  agent: string;
  output: StageOutput;
  valid: boolean;
  error?: string;
}

export interface ScrumSession {
  id: string;
  timestamp: string;
  topic: string;
  participants: string[];
  currentStage: ScrumStage;
  results: ScrumStageResult[];
  finalStatus: "pending" | "complete" | "failed";
}

export interface ScrumSessionResponse {
  session: ScrumSession;
  stageResult: ScrumStageResult;
}
