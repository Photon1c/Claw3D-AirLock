import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeText,
  extractKeywords,
  checkKeywordOverlap,
} from "../validation/topicAnchor";

describe("normalizeText", () => {
  it("lowercases text", () => {
    assert.equal(normalizeText("Hello WORLD"), "hello world");
  });

  it("strips punctuation but keeps apostrophes and hyphens", () => {
    assert.equal(normalizeText("it's a well-known fact!"), "it's a well-known fact");
  });

  it("collapses whitespace", () => {
    assert.equal(normalizeText("  too   much   space  "), "too much space");
  });

  it("strips question marks and exclamation marks", () => {
    assert.equal(normalizeText("What?! Really??"), "what really");
  });

  it("handles empty string", () => {
    assert.equal(normalizeText(""), "");
  });
});

describe("extractKeywords", () => {
  it("extracts content words from a normal topic", () => {
    const kw = extractKeywords("basement noise");
    assert.deepEqual(kw, ["basement", "noise"]);
  });

  it("filters stopwords", () => {
    const kw = extractKeywords("the weather is changing");
    assert.ok(!kw.includes("the"));
    assert.ok(!kw.includes("is"));
    assert.ok(kw.includes("weather"));
    assert.ok(kw.includes("changing"));
  });

  it("strips punctuation before extracting", () => {
    const kw = extractKeywords("basement noise?!");
    assert.ok(kw.includes("basement"));
    assert.ok(kw.includes("noise"));
    assert.ok(!kw.some((w) => w.includes("?")));
  });

  it("falls back on short topics like 'AI'", () => {
    const kw = extractKeywords("AI");
    assert.ok(kw.length > 0, "should not be empty for short topic");
    assert.ok(kw.includes("ai"));
  });

  it("falls back when all words are stopwords", () => {
    const kw = extractKeywords("the a an");
    assert.ok(kw.length > 0, "should fall back to raw tokens");
  });

  it("handles extra stopwords parameter", () => {
    const kw = extractKeywords("office coffee machine", new Set(["office"]));
    assert.ok(!kw.includes("office"));
    assert.ok(kw.includes("coffee"));
    assert.ok(kw.includes("machine"));
  });

  it("handles multi-word topic with mixed stopwords", () => {
    const kw = extractKeywords("who broke the coffee machine in the office");
    assert.ok(kw.includes("broke"));
    assert.ok(kw.includes("coffee"));
    assert.ok(kw.includes("machine"));
    assert.ok(kw.includes("office"));
    assert.ok(!kw.includes("who"));
    assert.ok(!kw.includes("the"));
  });
});

describe("checkKeywordOverlap", () => {
  it("detects topic keyword in text", () => {
    const r = checkKeywordOverlap(
      "That basement sounds weird",
      ["basement", "noise"],
      [],
    );
    assert.ok(r.anchored);
    assert.ok(r.matchedTopic);
    assert.ok(!r.matchedPrev);
  });

  it("detects previous-line keyword in text", () => {
    const r = checkKeywordOverlap(
      "Yeah I heard something heavy",
      ["basement", "noise"],
      ["heard", "something", "loud"],
    );
    assert.ok(r.anchored);
    assert.ok(!r.matchedTopic);
    assert.ok(r.matchedPrev);
  });

  it("detects both topic and previous-line", () => {
    const r = checkKeywordOverlap(
      "That basement noise sounded heavier than usual",
      ["basement", "noise"],
      ["heavier"],
    );
    assert.ok(r.anchored);
    assert.ok(r.matchedTopic);
    assert.ok(r.matchedPrev);
  });

  it("rejects text with no overlap", () => {
    const r = checkKeywordOverlap(
      "Let's get lunch today",
      ["basement", "noise"],
      ["heard", "something"],
    );
    assert.ok(!r.anchored);
    assert.ok(!r.matchedTopic);
    assert.ok(!r.matchedPrev);
  });

  it("handles empty topic keywords gracefully", () => {
    const r = checkKeywordOverlap("Some random text", [], ["random"]);
    assert.ok(r.anchored);
    assert.ok(!r.matchedTopic);
    assert.ok(r.matchedPrev);
  });

  it("handles empty prev keywords gracefully", () => {
    const r = checkKeywordOverlap("The basement is creepy", ["basement"], []);
    assert.ok(r.anchored);
    assert.ok(r.matchedTopic);
    assert.ok(!r.matchedPrev);
  });

  it("matches substring keywords (e.g. 'base' in 'basement')", () => {
    const r = checkKeywordOverlap("Check the basement", ["base"], []);
    assert.ok(r.anchored);
    assert.ok(r.matchedTopic);
  });

  it("strips punctuation before matching", () => {
    const r = checkKeywordOverlap(
      "What about the noise?!",
      ["noise"],
      [],
    );
    assert.ok(r.anchored);
  });
});
