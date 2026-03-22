export type ConversationIntent =
  | "observe"
  | "ask"
  | "answer"
  | "joke"
  | "redirect"
  | "agree"
  | "disagree"
  | "escalate";

export interface Utterance {
  speaker: string;
  text: string;
  intent: ConversationIntent;
  replyTo: number | null;
  timestamp?: string;
}

export interface ValidationResult {
  valid: boolean;
  retries: number;
  rejected_reasons: string[];
}

export interface CoolerSession {
  id: string;
  topic: string;
  location?: string;
  topicKeywords: string[];
  participants: string[];
  utterances: Utterance[];
  currentTurn: number;
  conversationHistory: string[];
  usedPhrases: Set<string>;
  validationDetails: ValidationResult[];
  startedAt?: string;
}

// ── Public API types ────────────────────────────────────────────────

export interface CreateSessionOptions {
  topic: string;
  participants: string[];
  location?: string;
}

export interface TurnResult {
  utterance: Utterance;
  validation: ValidationResult;
  repaired: boolean;
  intent: ConversationIntent;
}

export type GenerateFn = (prompt: string) => Promise<string>;

// ── Serialization types ─────────────────────────────────────────────

export interface SerializedUtterance {
  speaker: string;
  text: string;
  intent: ConversationIntent;
  replyTo: number | null;
  timestamp?: string;
  validation?: {
    valid: boolean;
    retries: number;
    rejected_reasons: string[];
  };
}

export interface SerializedSession {
  id: string;
  version: string;
  topic: string;
  location?: string;
  participants: string[];
  topicKeywords: string[];
  utterances: SerializedUtterance[];
  startedAt?: string;
  endedAt?: string;
}

export interface ConversationExport {
  markdown: string;
  json: SerializedSession;
}
