/**
 * Session serialization / deserialization.
 *
 * Converts between the runtime CoolerSession (which has Set, computed
 * fields) and a plain-JSON SerializedSession that can be stored, sent
 * over the wire, or round-tripped through JSON.parse/stringify.
 *
 * Design notes:
 *  - usedPhrases and conversationHistory are rebuilt from utterances
 *    during deserialization, so they never appear in the JSON.
 *  - Unknown extra fields in the input are silently ignored, making
 *    deserialization forward-compatible with future schema additions.
 */

import type {
  CoolerSession,
  SerializedSession,
  SerializedUtterance,
  Utterance,
  ValidationResult,
} from "../types";

export const SESSION_VERSION = "cooler_v2";

export function serializeSession(session: CoolerSession): SerializedSession {
  const utterances: SerializedUtterance[] = session.utterances.map((u, i) => {
    const val = session.validationDetails[i];
    const entry: SerializedUtterance = {
      speaker: u.speaker,
      text: u.text,
      intent: u.intent,
      replyTo: u.replyTo,
    };
    if (u.timestamp) entry.timestamp = u.timestamp;
    if (val) {
      entry.validation = {
        valid: val.valid,
        retries: val.retries,
        rejected_reasons: [...val.rejected_reasons],
      };
    }
    return entry;
  });

  const result: SerializedSession = {
    id: session.id,
    version: SESSION_VERSION,
    topic: session.topic,
    participants: [...session.participants],
    topicKeywords: [...session.topicKeywords],
    utterances,
  };

  if (session.location) result.location = session.location;
  if (session.startedAt) result.startedAt = session.startedAt;

  return result;
}

export function deserializeSession(data: SerializedSession): CoolerSession {
  const utterances: Utterance[] = data.utterances.map((u) => {
    const entry: Utterance = {
      speaker: u.speaker,
      text: u.text,
      intent: u.intent,
      replyTo: u.replyTo,
    };
    if (u.timestamp) entry.timestamp = u.timestamp;
    return entry;
  });

  const validationDetails: ValidationResult[] = data.utterances.map((u) =>
    u.validation
      ? {
          valid: u.validation.valid,
          retries: u.validation.retries,
          rejected_reasons: [...u.validation.rejected_reasons],
        }
      : { valid: true, retries: 0, rejected_reasons: [] },
  );

  const usedPhrases = new Set<string>();
  const conversationHistory: string[] = [];
  for (const u of utterances) {
    usedPhrases.add(u.text.toLowerCase());
    conversationHistory.push(`${u.speaker}: "${u.text}"`);
  }

  const session: CoolerSession = {
    id: data.id,
    topic: data.topic,
    topicKeywords: [...data.topicKeywords],
    participants: [...data.participants],
    utterances,
    currentTurn: utterances.length,
    conversationHistory,
    usedPhrases,
    validationDetails,
  };

  if (data.location) session.location = data.location;
  if (data.startedAt) session.startedAt = data.startedAt;

  return session;
}
