/**
 * Cooler Talk Conversation Controller
 *
 * Thin orchestration layer. All heavy lifting is delegated to:
 *   validation/*   — intent rules, topic anchoring, repetition
 *   repair/*       — deterministic fallback templates
 *   prompts/*      — model-facing prompt builder
 *   persistence/*  — serialize / deserialize sessions
 *   config.ts      — shared constants
 *   types.ts       — shared interfaces
 *
 * This file owns session lifecycle, intent sequencing, history
 * management, and serialization. It re-exports everything that
 * server/index.ts (and downstream consumers) expect.
 */

import { extractKeywords } from "./validation/topicAnchor";
import type {
  ConversationIntent,
  CoolerSession,
  CreateSessionOptions,
  Utterance,
  ValidationResult,
} from "./types";

// ── Re-exports (backwards-compatible public API) ────────────────────
export { validateUtterance } from "./validation/index";
export { getRepairText } from "./repair/repairTemplates";
export { buildTurnPrompt } from "./prompts/buildTurnPrompt";
export type {
  ConversationIntent,
  CoolerSession,
  CreateSessionOptions,
  Utterance,
  ValidationResult,
} from "./types";

// ── Intent sequencing ───────────────────────────────────────────────

const INTENT_SEQUENCE = {
  first:        ["ask", "observe"]                          as ConversationIntent[],
  afterAsk:     ["answer", "agree", "disagree", "joke"]     as ConversationIntent[],
  afterAnswer:  ["joke", "redirect", "agree", "observe"]    as ConversationIntent[],
  afterJoke:    ["observe", "ask", "agree", "redirect"]     as ConversationIntent[],
  afterAgree:   ["observe", "redirect", "ask"]              as ConversationIntent[],
  afterDisagree:["answer", "observe", "joke"]               as ConversationIntent[],
  afterObserve: ["answer", "ask", "joke", "agree"]          as ConversationIntent[],
  afterRedirect:["agree", "observe", "answer"]              as ConversationIntent[],
  closing:      ["redirect", "agree", "escalate"]           as ConversationIntent[],
};

function getAllowedIntents(
  utterances: Utterance[],
  turnIndex: number,
): ConversationIntent[] {
  if (turnIndex === 0) return INTENT_SEQUENCE.first;

  const lastUtterance = utterances[turnIndex - 1];
  const remaining =
    utterances.length > 0 ? utterances.length - (turnIndex - 1) : 3;

  if (remaining <= 1) return INTENT_SEQUENCE.closing;

  switch (lastUtterance.intent) {
    case "ask":       return INTENT_SEQUENCE.afterAsk;
    case "answer":    return INTENT_SEQUENCE.afterAnswer;
    case "joke":      return INTENT_SEQUENCE.afterJoke;
    case "agree":     return INTENT_SEQUENCE.afterAgree;
    case "disagree":  return INTENT_SEQUENCE.afterDisagree;
    case "observe":   return INTENT_SEQUENCE.afterObserve;
    case "redirect":  return INTENT_SEQUENCE.afterRedirect;
    default:          return INTENT_SEQUENCE.afterObserve;
  }
}

function needsQuestion(utterances: Utterance[]): boolean {
  return !utterances.some((u) => u.intent === "ask");
}

function needsAnswer(utterances: Utterance[]): boolean {
  const askIndex = utterances.findIndex((u) => u.intent === "ask");
  if (askIndex === -1) return false;
  return !utterances
    .slice(askIndex)
    .some(
      (u) =>
        u.intent === "answer" ||
        u.intent === "agree" ||
        u.intent === "disagree",
    );
}

// ── Session lifecycle ───────────────────────────────────────────────

/**
 * Creates a new conversation session.
 *
 * Supports both the legacy positional signature and the new options
 * object for forward-compatible callers:
 *   createCoolerSession("topic", ["A","B"])
 *   createCoolerSession({ topic: "topic", participants: ["A","B"], location: "kitchen" })
 */
export function createCoolerSession(
  topic: string,
  participants: string[],
): CoolerSession;
export function createCoolerSession(
  options: CreateSessionOptions,
): CoolerSession;
export function createCoolerSession(
  topicOrOpts: string | CreateSessionOptions,
  participantsArg?: string[],
): CoolerSession {
  let topic: string;
  let participants: string[];
  let location: string | undefined;

  if (typeof topicOrOpts === "string") {
    topic = topicOrOpts;
    participants = participantsArg!;
  } else {
    topic = topicOrOpts.topic;
    participants = topicOrOpts.participants;
    location = topicOrOpts.location;
  }

  const shuffled = [...participants].sort(() => Math.random() - 0.5);

  const session: CoolerSession = {
    id: `ct-${Date.now()}`,
    topic,
    topicKeywords: extractKeywords(topic),
    participants: shuffled,
    utterances: [],
    currentTurn: 0,
    conversationHistory: [],
    usedPhrases: new Set(),
    validationDetails: [],
    startedAt: new Date().toISOString(),
  };

  if (location) session.location = location;

  return session;
}

export function getNextIntent(session: CoolerSession): ConversationIntent {
  const allowed = getAllowedIntents(session.utterances, session.currentTurn);

  if (needsQuestion(session.utterances) && allowed.includes("ask")) {
    return "ask";
  }
  if (needsAnswer(session.utterances) && allowed.includes("answer")) {
    return "answer";
  }

  return allowed[Math.floor(Math.random() * allowed.length)];
}

export function addUtteranceToHistory(
  session: CoolerSession,
  utterance: Utterance,
): void {
  session.conversationHistory.push(
    `${utterance.speaker}: "${utterance.text}"`,
  );
  session.usedPhrases.add(utterance.text.toLowerCase());
}

// ── Serialization ───────────────────────────────────────────────────

export function serializeSessionLog(session: CoolerSession): string {
  return session.utterances
    .map((u, i) => {
      const details = session.validationDetails[i];
      const retryInfo = details
        ? ` (valid: ${details.valid}, retries: ${details.retries})`
        : "";
      return `- **${u.speaker}** (${u.intent}${u.replyTo !== null ? `, reply_to: ${u.replyTo}` : ""}): ${u.text}${retryInfo}`;
    })
    .join("\n");
}

export function sessionToMarkdown(session: CoolerSession): string {
  const locationLine = session.location
    ? `\n**Location:** ${session.location}`
    : "";

  return `
## Cooler Talk Session - ${session.id}

**Topic:** ${session.topic}${locationLine}
**Keywords:** ${session.topicKeywords.join(", ")}
**Participants:** ${session.participants.join(", ")}

### Dialogue

${serializeSessionLog(session)}
---
`;
}
