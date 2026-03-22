/**
 * Deterministic repair templates.
 *
 * After maxRetries failed validation attempts the engine falls back to
 * these canned lines to keep the conversation moving.
 */

import type { ConversationIntent } from "../types";

type RepairFn = (topic: string, prevText?: string) => string;

// BUG FIX: agree/disagree/answer templates previously omitted the topic,
// which caused them to fail topic-anchoring validation. Repair text must
// always self-validate since it's the last-resort fallback.
const REPAIR_TEMPLATES: Record<ConversationIntent, RepairFn> = {
  ask:      (topic)     => `Did anyone else notice the ${topic}?`,
  answer:   (topic)     => `Yeah, I noticed the ${topic} too.`,
  observe:  (topic)     => `The ${topic} seems different today.`,
  joke:     (topic)     => `At least the ${topic} keeps things interesting!`,
  agree:    (topic)     => `Exactly, good point about the ${topic}.`,
  disagree: (topic)     => `I'm not sure about that ${topic} situation.`,
  redirect: (topic)     => `Speaking of ${topic}, should we check on that?`,
  escalate: (topic)     => `We should really address the ${topic} situation!`,
};

export function getRepairText(
  intent: ConversationIntent,
  topic: string,
  prevText?: string,
): string {
  return REPAIR_TEMPLATES[intent](topic, prevText);
}
