/**
 * Topic anchoring: keyword extraction and overlap detection.
 *
 * Every utterance must reference the conversation topic OR the previous line.
 * We extract meaningful keywords (filtering stopwords) and check whether the
 * candidate text contains at least one of them.
 */

import { STOPWORDS, COOLER_CONFIG } from "../config";

/**
 * Normalizes text for comparison: lowercase, strip punctuation
 * (keeping apostrophes/hyphens for contractions and compound words),
 * and collapse whitespace.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts meaningful keywords from a string.
 *
 * Falls back to keeping all non-empty tokens if stopword filtering
 * would produce an empty set (handles very short topics like "AI").
 */
export function extractKeywords(
  text: string,
  extraStopwords?: Set<string>,
): string[] {
  const stops = extraStopwords
    ? new Set([...STOPWORDS, ...extraStopwords])
    : STOPWORDS;

  const normalized = normalizeText(text);
  const words = normalized
    .split(/\s+/)
    .filter((w) => w.length >= COOLER_CONFIG.minKeywordLength && !stops.has(w));

  if (words.length === 0) {
    return normalized.split(/\s+/).filter((w) => w.length > 0);
  }

  return words;
}

export interface AnchorResult {
  anchored: boolean;
  matchedTopic: boolean;
  matchedPrev: boolean;
}

/**
 * Checks whether `text` contains at least one keyword from the topic
 * or from the previous line. Returns structured result so the caller
 * can log exactly which anchor (or neither) was hit.
 */
export function checkKeywordOverlap(
  text: string,
  topicKeywords: string[],
  prevKeywords: string[],
): AnchorResult {
  const textNorm = normalizeText(text);

  const matchedTopic =
    topicKeywords.length > 0 && topicKeywords.some((k) => textNorm.includes(k));

  const matchedPrev =
    prevKeywords.length > 0 && prevKeywords.some((k) => textNorm.includes(k));

  return {
    anchored: matchedTopic || matchedPrev,
    matchedTopic,
    matchedPrev,
  };
}
