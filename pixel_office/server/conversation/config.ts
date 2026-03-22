/**
 * Cooler Talk configuration constants.
 *
 * promptMaxWords is what we tell the model to aim for (12).
 * maxWords is the hard validation reject threshold (15) — gives the model
 * a few words of slack before we throw the line out entirely.
 */
export const COOLER_CONFIG = {
  maxWords: 15,
  promptMaxWords: 12,
  minWords: 2,
  similarityThreshold: 0.7,
  maxRetries: 5,
  minKeywordLength: 2,
} as const;

export const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "about", "from", "or", "and", "if", "to", "in", "on", "at", "of", "for",
  "who", "what", "why", "how", "when", "where", "whether",
  "that", "this", "these", "those",
  "i", "you", "we", "they", "it", "he", "she",
  "my", "your", "our", "their", "its", "his", "her",
  "me", "us", "them", "him",
  "do", "does", "did", "has", "have", "had",
  "not", "no", "but", "so", "just", "too", "also",
  "can", "could", "would", "should", "will", "shall", "may", "might",
  "with", "by", "up", "out", "off",
]);
