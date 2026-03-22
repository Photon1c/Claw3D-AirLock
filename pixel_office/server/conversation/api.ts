/**
 * Cooler Talk — public API surface.
 *
 * This module provides the high-level functions that a server, UI, or
 * SCRUM system should call. It wraps the internal controller, validation,
 * repair, and persistence modules into a small ergonomic interface.
 *
 * Session mutation:
 *   runNextTurn() mutates the session **in place** (documented contract).
 *   This avoids expensive deep-clones on every turn while keeping the API
 *   simple. Callers who need immutability should serialize before mutating.
 */

import {
  createCoolerSession,
  getNextIntent,
  addUtteranceToHistory,
  validateUtterance,
  buildTurnPrompt,
  getRepairText,
  sessionToMarkdown,
} from "./coolerController";
import { serializeSession } from "./persistence/serialize";
import { COOLER_CONFIG } from "./config";
import type {
  CoolerSession,
  CreateSessionOptions,
  TurnResult,
  Utterance,
  GenerateFn,
  ConversationExport,
} from "./types";

function cleanModelOutput(raw: string): string {
  return raw
    .replace(/^["']+|["']+$/g, "")
    .replace(/^\*[^*]*\*\s*/g, "")
    .replace(/\n.*/g, "")
    .trim();
}

/**
 * Runs a single conversation turn. Mutates session in-place.
 *
 * If generateFn is provided, calls it up to maxRetries times, validating
 * each response. Falls back to deterministic repair on exhaustion.
 * If generateFn is omitted, uses repair immediately (useful for testing).
 */
export async function runNextTurn(
  session: CoolerSession,
  generateFn?: GenerateFn,
): Promise<TurnResult> {
  const speaker =
    session.participants[session.currentTurn % session.participants.length];
  const intent = getNextIntent(session);

  let utterance: Utterance | null = null;
  let validation = {
    valid: false,
    retries: 0,
    rejected_reasons: [] as string[],
  };
  let repaired = false;

  if (generateFn) {
    const prompt = buildTurnPrompt(session, speaker, intent);

    for (let attempt = 0; attempt < COOLER_CONFIG.maxRetries; attempt++) {
      const raw = await generateFn(prompt);
      const cleaned = cleanModelOutput(raw);

      const candidate: Utterance = {
        speaker,
        text: cleaned,
        intent,
        replyTo: session.currentTurn > 0 ? session.currentTurn - 1 : null,
      };

      const result = validateUtterance(candidate, session, session.utterances);

      if (result.valid) {
        utterance = candidate;
        validation = { ...result, retries: attempt + 1 };
        break;
      }

      validation = { ...result, retries: attempt + 1 };
    }
  }

  if (!utterance) {
    const prevText =
      session.utterances[session.utterances.length - 1]?.text;
    const repairText = getRepairText(intent, session.topic, prevText);

    utterance = {
      speaker,
      text: repairText,
      intent,
      replyTo: session.currentTurn > 0 ? session.currentTurn - 1 : null,
    };

    const result = validateUtterance(utterance, session, session.utterances);
    validation = { ...result, retries: validation.retries };
    repaired = true;
  }

  session.utterances.push(utterance);
  session.validationDetails.push(validation);
  addUtteranceToHistory(session, utterance);
  session.currentTurn++;

  return { utterance, validation, repaired, intent };
}

/**
 * Runs a complete conversation for up to maxTurns turns.
 */
export async function runSession(
  options: CreateSessionOptions,
  maxTurns: number,
  generateFn?: GenerateFn,
): Promise<CoolerSession> {
  const session = createCoolerSession(options);
  for (let i = 0; i < maxTurns; i++) {
    await runNextTurn(session, generateFn);
  }
  return session;
}

/**
 * Returns both markdown and structured JSON for a session.
 */
export function exportSession(session: CoolerSession): ConversationExport {
  return {
    markdown: sessionToMarkdown(session),
    json: serializeSession(session),
  };
}

// Re-export core functions so api.ts can serve as a single entry point
export { createCoolerSession } from "./coolerController";
export { serializeSession, deserializeSession } from "./persistence/serialize";
export type {
  CoolerSession,
  CreateSessionOptions,
  TurnResult,
  Utterance,
  GenerateFn,
  ConversationExport,
  SerializedSession,
  ConversationIntent,
  ValidationResult,
} from "./types";
