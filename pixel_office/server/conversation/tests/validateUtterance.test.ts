import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateUtterance } from "../validation/index";
import { createCoolerSession, addUtteranceToHistory } from "../coolerController";
import type { Utterance } from "../types";

function mkSession(topic: string) {
  return createCoolerSession(topic, ["Alice", "Bob"]);
}

function mkUtterance(
  text: string,
  intent: Utterance["intent"],
  speaker = "Alice",
): Utterance {
  return { speaker, text, intent, replyTo: null };
}

describe("validateUtterance — length checks", () => {
  it("rejects too-long utterance (>15 words)", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance(
      "This is a very long sentence about the basement noise that keeps going on and on and on",
      "observe",
    );
    const r = validateUtterance(u, s, []);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.includes("too_long"));
  });

  it("accepts utterance at exactly 15 words", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance(
      "I really think the basement noise is getting much louder every single day now honestly",
      "observe",
    );
    const words = u.text.split(/\s+/).length;
    assert.equal(words, 15);
    const r = validateUtterance(u, s, []);
    assert.ok(!r.rejected_reasons.includes("too_long"));
  });

  it("rejects too-short utterance (<2 words)", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("Yep", "agree");
    const r = validateUtterance(u, s, []);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.includes("too_short"));
  });
});

describe("validateUtterance — intent rules", () => {
  it("rejects ask without question form", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("The basement noise stopped", "ask");
    const r = validateUtterance(u, s, []);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.includes("ask_without_question_marker"));
  });

  it("rejects answer that is actually a question", () => {
    const s = mkSession("basement noise");
    const prev = mkUtterance("Did anyone hear that noise?", "ask");
    const u = mkUtterance("Did you mean the basement noise?", "answer");
    const r = validateUtterance(u, s, [prev]);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.includes("answer_contains_question"));
  });

  it("accepts valid ask with question mark", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("Did anyone hear that basement noise?", "ask");
    const r = validateUtterance(u, s, []);
    assert.ok(r.valid, `expected valid, got reasons: ${r.rejected_reasons}`);
  });

  it("accepts valid answer referencing previous line", () => {
    const s = mkSession("basement noise");
    const prev = mkUtterance("Did anyone hear that noise?", "ask");
    const u = mkUtterance("Yeah that noise sounded heavy", "answer", "Bob");
    const r = validateUtterance(u, s, [prev]);
    assert.ok(r.valid, `expected valid, got reasons: ${r.rejected_reasons}`);
  });
});

describe("validateUtterance — topic anchoring", () => {
  it("rejects utterance with no topic or prev-line reference", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("Let's grab some lunch today", "observe");
    const r = validateUtterance(u, s, []);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.includes("no_topic_or_prev_reference"));
  });

  it("accepts utterance anchored to topic", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("The basement seems creepy today", "observe");
    const r = validateUtterance(u, s, []);
    assert.ok(r.valid, `expected valid, got reasons: ${r.rejected_reasons}`);
  });

  it("accepts utterance anchored to previous line only", () => {
    const s = mkSession("basement noise");
    const prev = mkUtterance("That sounded really heavy", "observe");
    const u = mkUtterance("Yeah heavy stuff falling maybe", "agree", "Bob");
    const r = validateUtterance(u, s, [prev]);
    assert.ok(r.valid, `expected valid, got reasons: ${r.rejected_reasons}`);
  });

  it("handles weak anchoring — short topic 'AI'", () => {
    const s = mkSession("AI");
    const u = mkUtterance("AI is changing everything lately", "observe");
    const r = validateUtterance(u, s, []);
    assert.ok(r.valid, `short topic 'AI' should still anchor, got: ${r.rejected_reasons}`);
  });
});

describe("validateUtterance — repetition", () => {
  it("rejects exact duplicate", () => {
    const s = mkSession("basement noise");
    const prev = mkUtterance("The basement noise is weird", "observe");
    addUtteranceToHistory(s, prev);
    s.utterances.push(prev);

    const u = mkUtterance("The basement noise is weird", "observe", "Bob");
    const r = validateUtterance(u, s, s.utterances);
    assert.ok(!r.valid);
    const hasRepReason =
      r.rejected_reasons.includes("exact_duplicate") ||
      r.rejected_reasons.includes("too_similar");
    assert.ok(hasRepReason, `expected repetition reason, got: ${r.rejected_reasons}`);
  });

  it("does not false-reject lines sharing only filler words", () => {
    const s = mkSession("basement noise");
    const prev = mkUtterance("I think the weather looks nice", "observe");
    addUtteranceToHistory(s, prev);
    s.utterances.push(prev);

    const u = mkUtterance("I think that basement noise is creepy", "observe", "Bob");
    const r = validateUtterance(u, s, s.utterances);
    const falseRep =
      r.rejected_reasons.includes("exact_duplicate") ||
      r.rejected_reasons.includes("too_similar");
    assert.ok(!falseRep, `should not flag different content as duplicate, got: ${r.rejected_reasons}`);
  });
});

describe("validateUtterance — collects multiple reasons", () => {
  it("reports all failures, not just the first", () => {
    const s = mkSession("basement noise");
    // Too short + no agreement signal + no topic reference
    const u = mkUtterance("OK", "agree");
    const r = validateUtterance(u, s, []);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.length >= 2, `expected multiple reasons, got: ${r.rejected_reasons}`);
    assert.ok(r.rejected_reasons.includes("too_short"));
  });
});

describe("validateUtterance — punctuation edge cases", () => {
  it("handles punctuation-heavy text correctly", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("Wait... that basement noise?!", "ask");
    const r = validateUtterance(u, s, []);
    assert.ok(r.valid, `expected valid, got reasons: ${r.rejected_reasons}`);
  });

  it("handles text with only punctuation and filler", () => {
    const s = mkSession("basement noise");
    const u = mkUtterance("Hmm... well...", "observe");
    const r = validateUtterance(u, s, []);
    assert.ok(!r.valid);
    assert.ok(r.rejected_reasons.includes("no_topic_or_prev_reference"));
  });
});
