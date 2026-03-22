import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  phraseKey,
  contentSimilarity,
  checkRepetition,
} from "../validation/repetition";

describe("phraseKey", () => {
  it("lowercases and strips punctuation", () => {
    assert.equal(phraseKey("Hello World!"), "hello world");
  });

  it("collapses whitespace", () => {
    assert.equal(phraseKey("  too   much   space  "), "too much space");
  });

  it("normalizes equivalent phrases to same key", () => {
    assert.equal(
      phraseKey("That's weird, right?"),
      phraseKey("that's weird right"),
    );
  });
});

describe("contentSimilarity", () => {
  it("returns 1.0 for identical content", () => {
    const sim = contentSimilarity(
      "basement noise today",
      "basement noise today",
    );
    assert.equal(sim, 1.0);
  });

  it("returns 0 for completely different content words", () => {
    const sim = contentSimilarity("basement noise", "coffee machine");
    assert.equal(sim, 0);
  });

  it("returns partial overlap for shared words", () => {
    const sim = contentSimilarity(
      "that basement noise is loud",
      "basement noise seems different today",
    );
    assert.ok(sim > 0, "should have some overlap");
    assert.ok(sim < 1, "should not be identical");
  });

  it("ignores stopwords in similarity — reduces false positives", () => {
    // These share "I think" but differ in content
    const sim = contentSimilarity(
      "I think that is right",
      "I think we should leave",
    );
    // "think" is a content word, "right" vs "leave" differ
    assert.ok(sim < 0.7, `should be below threshold, got ${sim}`);
  });

  it("returns 0 when both texts are only stopwords", () => {
    const sim = contentSimilarity("I am so it is", "they are but we do");
    assert.equal(sim, 0);
  });

  it("handles punctuation-heavy text", () => {
    const sim = contentSimilarity(
      "Wait... really?!?",
      "Wait, really!",
    );
    assert.equal(sim, 1.0);
  });
});

describe("checkRepetition", () => {
  it("detects exact duplicate in usedPhrases", () => {
    const used = new Set(["that noise is weird"]);
    const r = checkRepetition("That noise is weird!", used, []);
    assert.ok(r.isDuplicate);
    assert.equal(r.reason, "exact_duplicate");
  });

  it("detects exact duplicate in allUtteranceTexts", () => {
    const r = checkRepetition(
      "The basement sounds creepy.",
      new Set(),
      ["The basement sounds creepy."],
    );
    assert.ok(r.isDuplicate);
    assert.equal(r.reason, "exact_duplicate");
  });

  it("detects fuzzy duplicate above threshold", () => {
    // content words: "basement noise sounded heavy today"
    // vs:            "basement noise sounded heavy again"
    // intersection=4 (basement,noise,sounded,heavy), union=6 → 0.67 below 0.7
    // Use closer match: same 4 content words, union=5 → 0.8
    const used = new Set(["the basement noise sounded really heavy"]);
    const r = checkRepetition(
      "that basement noise sounded so heavy",
      used,
      [],
    );
    assert.ok(r.isDuplicate, `expected duplicate, sim should be high for shared content words`);
    assert.equal(r.reason, "too_similar");
  });

  it("does NOT flag semantically different lines sharing filler words", () => {
    const used = new Set(["I think the weather looks nice today"]);
    const r = checkRepetition(
      "I think the basement noise is getting worse",
      used,
      [],
    );
    assert.ok(!r.isDuplicate, "should not flag different content");
  });

  it("returns clean result for unique phrase", () => {
    const used = new Set(["hello there"]);
    const r = checkRepetition("basement noise is weird", used, []);
    assert.ok(!r.isDuplicate);
    assert.equal(r.reason, null);
  });

  it("handles empty usedPhrases and empty utterance list", () => {
    const r = checkRepetition("anything goes", new Set(), []);
    assert.ok(!r.isDuplicate);
  });

  it("respects custom threshold", () => {
    const used = new Set(["basement noise sounded heavy"]);
    // With threshold=1.0, only exact content-word match would trigger
    const r = checkRepetition(
      "basement noise sounded weird",
      used,
      [],
      1.0,
    );
    assert.ok(!r.isDuplicate);
  });
});
