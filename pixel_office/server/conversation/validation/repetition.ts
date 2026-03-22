/**
 * Anti-repetition: phrase normalization, exact-duplicate detection,
 * and content-word Jaccard similarity.
 *
 * Key improvement over the original: similarity is computed on *content
 * words only* (stopwords removed), so two lines that share common
 * function words but differ in meaning won't be falsely flagged.
 */

import { STOPWORDS, COOLER_CONFIG } from "../config";
import { normalizeText } from "./topicAnchor";

/**
 * Returns a normalized key for exact-duplicate comparison.
 * Strips punctuation, collapses whitespace, lowercases.
 */
export function phraseKey(text: string): string {
  return normalizeText(text);
}

/**
 * Extracts content words (removes stopwords + single-char tokens).
 * Used for similarity so filler words don't inflate the score.
 */
function contentWords(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Jaccard similarity on content-word sets.
 * Returns 0–1 where 1 means identical content word sets.
 *
 * If both sides have zero content words they're treated as dissimilar
 * (topic anchoring handles whether they're valid at all).
 */
export function contentSimilarity(a: string, b: string): number {
  const wordsA = contentWords(a);
  const wordsB = contentWords(b);

  if (wordsA.length === 0 && wordsB.length === 0) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;

  if (union === 0) return 0;
  return intersection / union;
}

export interface RepetitionResult {
  isDuplicate: boolean;
  reason: "exact_duplicate" | "too_similar" | null;
  similarity?: number;
  matchedPhrase?: string;
}

/**
 * Checks a candidate phrase against the session's used-phrase memory
 * and the raw utterance history. Returns a structured result with the
 * specific reason and the phrase it matched against.
 */
export function checkRepetition(
  text: string,
  usedPhrases: Set<string>,
  allUtteranceTexts: string[],
  threshold = COOLER_CONFIG.similarityThreshold,
): RepetitionResult {
  const key = phraseKey(text);

  for (const used of usedPhrases) {
    if (phraseKey(used) === key) {
      return { isDuplicate: true, reason: "exact_duplicate", matchedPhrase: used };
    }
  }

  for (const prev of allUtteranceTexts) {
    if (phraseKey(prev) === key) {
      return { isDuplicate: true, reason: "exact_duplicate", matchedPhrase: prev };
    }
  }

  for (const used of usedPhrases) {
    const sim = contentSimilarity(text, used);
    if (sim >= threshold) {
      return {
        isDuplicate: true,
        reason: "too_similar",
        similarity: sim,
        matchedPhrase: used,
      };
    }
  }

  return { isDuplicate: false, reason: null };
}
