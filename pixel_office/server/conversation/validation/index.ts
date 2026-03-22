/**
 * Validation orchestrator.
 *
 * Composes intent rules, topic anchoring, and repetition detection into
 * a single validateUtterance call. Collects *all* failing reasons rather
 * than short-circuiting so logs capture every rule that fired.
 */

import type { Utterance, ValidationResult, CoolerSession } from "../types";
import { COOLER_CONFIG } from "../config";
import { checkIntentRules } from "./intentRules";
import { extractKeywords, checkKeywordOverlap } from "./topicAnchor";
import { checkRepetition } from "./repetition";

export function validateUtterance(
  utterance: Utterance,
  session: CoolerSession,
  allUtterances: Utterance[],
): ValidationResult {
  const reasons: string[] = [];

  const text = utterance.text;
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  if (wordCount > COOLER_CONFIG.maxWords) {
    reasons.push("too_long");
  }
  if (wordCount < COOLER_CONFIG.minWords) {
    reasons.push("too_short");
  }

  const intentResult = checkIntentRules(utterance.intent, text);
  if (!intentResult.valid && intentResult.reason) {
    reasons.push(intentResult.reason);
  }

  const lastUtterance = allUtterances[allUtterances.length - 1];
  const prevKeywords = lastUtterance ? extractKeywords(lastUtterance.text) : [];

  const anchor = checkKeywordOverlap(text, session.topicKeywords, prevKeywords);
  if (!anchor.anchored) {
    reasons.push("no_topic_or_prev_reference");
  }

  const allTexts = allUtterances.map((u) => u.text);
  const rep = checkRepetition(text, session.usedPhrases, allTexts);
  if (rep.isDuplicate && rep.reason) {
    reasons.push(rep.reason);
  }

  return {
    valid: reasons.length === 0,
    retries: 0,
    rejected_reasons: reasons,
  };
}
