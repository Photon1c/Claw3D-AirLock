/**
 * Intent-specific validation rules.
 *
 * Each intent has a deterministic check that inspects the utterance text
 * for required lexical signals. Intents whose validity is determined
 * solely by topic anchoring (joke, observe, redirect) pass here and
 * are caught by the anchoring check instead.
 *
 * Improvement over Phase 2: added disagree signal detection and
 * expanded agree/escalate word lists to reduce false rejections.
 */

import type { ConversationIntent } from "../types";

export interface IntentCheckResult {
  valid: boolean;
  reason: string | null;
}

const ASK_INTERROGATIVES =
  /\b(who|what|why|how|when|where|does|did|is|are|can|could|should|would|do|has|have|will)\b/i;

const AGREE_SIGNALS =
  /\b(yeah|yes|true|exactly|good point|i agree|totally|absolutely|certainly|right|definitely|for sure)\b/i;

const URGENCY_SIGNALS =
  /\b(should|need to|must|important|serious|urgent|right now|asap|quick|critical|immediately|have to|gotta|better)\b/i;

const DISAGREE_SIGNALS =
  /\b(not sure|don't think|disagree|differently|actually|but|however|no|nah|doubt|wouldn't say)\b/i;

export function checkIntentRules(
  intent: ConversationIntent,
  text: string,
): IntentCheckResult {
  switch (intent) {
    case "ask":
      if (!text.includes("?") && !ASK_INTERROGATIVES.test(text)) {
        return { valid: false, reason: "ask_without_question_marker" };
      }
      return { valid: true, reason: null };

    case "answer":
      if (text.includes("?")) {
        return { valid: false, reason: "answer_contains_question" };
      }
      return { valid: true, reason: null };

    case "agree":
      if (!AGREE_SIGNALS.test(text)) {
        return { valid: false, reason: "agree_without_agreement_signal" };
      }
      return { valid: true, reason: null };

    case "disagree":
      if (!DISAGREE_SIGNALS.test(text)) {
        return { valid: false, reason: "disagree_without_disagreement_signal" };
      }
      return { valid: true, reason: null };

    case "escalate":
      if (!URGENCY_SIGNALS.test(text)) {
        return { valid: false, reason: "escalate_without_urgency_signal" };
      }
      return { valid: true, reason: null };

    case "joke":
    case "observe":
    case "redirect":
      return { valid: true, reason: null };

    default:
      return { valid: true, reason: null };
  }
}
