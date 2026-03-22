import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCoolerSession,
  validateUtterance,
  getNextIntent,
  addUtteranceToHistory,
  getRepairText,
  buildTurnPrompt,
  sessionToMarkdown,
} from "../coolerController";
import type { Utterance } from "../types";
import { COOLER_CONFIG } from "../config";

function mkUtterance(
  speaker: string,
  text: string,
  intent: Utterance["intent"],
  replyTo: number | null = null,
): Utterance {
  return { speaker, text, intent, replyTo };
}

// ── Regression: "basement noise" spec example ────────────────────────

describe("basement noise — regression from Phase 2 spec", () => {
  // NOTE: The original spec example used "Should we check if maintenance logged that?"
  // as a redirect, but that line contains no keywords from topic "basement noise"
  // or from the previous line. The original engine would also reject it — keyword
  // anchoring requires at least one content-word overlap. The line below is adjusted
  // to actually anchor while keeping the same conversational flow.
  it("validates the full example conversation from the spec", () => {
    const session = createCoolerSession("basement noise", [
      "FrontDesk", "IronClaw", "Sherlobster", "OpenClaw", "LeslieClaw",
    ]);

    const lines: Utterance[] = [
      mkUtterance("FrontDesk",   "Did anyone hear that noise from the basement?",       "ask"),
      mkUtterance("IronClaw",    "Yeah, that basement noise sounded heavier than usual", "answer"),
      mkUtterance("Sherlobster",  "If that basement noise is alive, I'm leaving",         "joke"),
      mkUtterance("OpenClaw",    "Should we check if that noise was logged?",             "redirect"),
      mkUtterance("LeslieClaw",  "Yeah, tracking that noise makes sense",                "agree"),
      mkUtterance("IronClaw",    "We should inspect the basement before it worsens",     "escalate"),
    ];

    for (let i = 0; i < lines.length; i++) {
      const prev = lines.slice(0, i);
      const r = validateUtterance(lines[i], session, prev);
      assert.ok(
        r.valid,
        `Line ${i} "${lines[i].text}" should be valid, got: ${r.rejected_reasons}`,
      );
      addUtteranceToHistory(session, lines[i]);
      session.utterances.push(lines[i]);
    }

    const md = sessionToMarkdown(session);
    assert.ok(md.includes("basement noise"));
    assert.ok(md.includes("FrontDesk"));
  });
});

// ── Full conversation flow integration ────────────────────────────────

describe("full conversation flow", () => {
  it("creates a session, picks intents, validates, adds history", () => {
    const session = createCoolerSession("office coffee machine", [
      "Alice", "Bob", "Charlie",
    ]);

    assert.ok(session.id.startsWith("ct-"));
    assert.ok(session.topicKeywords.includes("coffee"));
    assert.ok(session.topicKeywords.includes("machine"));
    assert.ok(session.topicKeywords.includes("office"));

    const intent1 = getNextIntent(session);
    assert.ok(
      ["ask", "observe"].includes(intent1),
      `first intent should be ask or observe, got ${intent1}`,
    );

    const u1 = mkUtterance("Alice", "Did anyone try the new coffee machine?", "ask");
    const r1 = validateUtterance(u1, session, []);
    assert.ok(r1.valid, `u1 should be valid, got: ${r1.rejected_reasons}`);

    session.utterances.push(u1);
    session.currentTurn++;
    addUtteranceToHistory(session, u1);

    const u2 = mkUtterance("Bob", "Yeah the coffee machine makes great espresso", "answer");
    const r2 = validateUtterance(u2, session, session.utterances);
    assert.ok(r2.valid, `u2 should be valid, got: ${r2.rejected_reasons}`);

    session.utterances.push(u2);
    session.currentTurn++;
    addUtteranceToHistory(session, u2);

    const u3 = mkUtterance("Charlie", "Exactly, that espresso is surprisingly good", "agree");
    const r3 = validateUtterance(u3, session, session.utterances);
    assert.ok(r3.valid, `u3 should be valid, got: ${r3.rejected_reasons}`);
  });

  it("rejects duplicate line within a conversation", () => {
    const session = createCoolerSession("printer problems", ["Alice", "Bob"]);

    const u1 = mkUtterance("Alice", "The printer keeps jamming today", "observe");
    const r1 = validateUtterance(u1, session, []);
    assert.ok(r1.valid);
    session.utterances.push(u1);
    addUtteranceToHistory(session, u1);

    const u2 = mkUtterance("Bob", "The printer keeps jamming today", "observe");
    const r2 = validateUtterance(u2, session, session.utterances);
    assert.ok(!r2.valid);
    assert.ok(
      r2.rejected_reasons.includes("exact_duplicate") ||
      r2.rejected_reasons.includes("too_similar"),
    );
  });
});

// ── Repair fallback ──────────────────────────────────────────────────

describe("repair fallback", () => {
  it("generates valid repair text for each intent", () => {
    const intents: Utterance["intent"][] = [
      "ask", "answer", "observe", "joke", "agree", "disagree", "redirect", "escalate",
    ];

    for (const intent of intents) {
      const text = getRepairText(intent, "basement noise", "something previous");
      assert.ok(text.length > 0, `repair for ${intent} should not be empty`);
      assert.ok(typeof text === "string");
    }
  });

  it("repair text for ask includes topic and question mark", () => {
    const text = getRepairText("ask", "basement noise");
    assert.ok(text.includes("basement noise"));
    assert.ok(text.includes("?"));
  });

  it("repair text for agree includes agreement signal and topic", () => {
    const text = getRepairText("agree", "topic");
    assert.ok(/exactly|agree|totally/i.test(text));
    assert.ok(text.includes("topic"));
  });

  it("repair text for escalate includes urgency", () => {
    const text = getRepairText("escalate", "basement noise");
    assert.ok(/should|must|need/i.test(text));
  });

  it("repair text validates against the engine", () => {
    const session = createCoolerSession("basement noise", ["Alice"]);
    const repairText = getRepairText("ask", "basement noise");
    const u = mkUtterance("Alice", repairText, "ask");
    const r = validateUtterance(u, session, []);
    assert.ok(r.valid, `repair text should self-validate, got: ${r.rejected_reasons}`);
  });

  it("ALL repair templates self-validate for every intent", () => {
    const intents: Utterance["intent"][] = [
      "ask", "answer", "observe", "joke", "agree", "disagree", "redirect", "escalate",
    ];
    const session = createCoolerSession("basement noise", ["Alice"]);

    for (const intent of intents) {
      const text = getRepairText(intent, "basement noise");
      const u = mkUtterance("Alice", text, intent);
      const r = validateUtterance(u, session, []);
      assert.ok(
        r.valid,
        `repair for "${intent}" must self-validate: "${text}" got: ${r.rejected_reasons}`,
      );
    }
  });
});

// ── Prompt builder ───────────────────────────────────────────────────

describe("buildTurnPrompt", () => {
  it("includes topic in prompt", () => {
    const session = createCoolerSession("basement noise", ["Alice"]);
    const prompt = buildTurnPrompt(session, "FrontDesk", "ask");
    assert.ok(prompt.includes("basement noise"));
  });

  it("includes personality when agent is known", () => {
    const session = createCoolerSession("basement noise", ["FrontDesk"]);
    const prompt = buildTurnPrompt(session, "FrontDesk", "ask");
    assert.ok(prompt.includes("Receptionist"));
  });

  it("includes max word count from config", () => {
    const session = createCoolerSession("basement noise", ["Alice"]);
    const prompt = buildTurnPrompt(session, "Alice", "ask");
    assert.ok(prompt.includes(`${COOLER_CONFIG.promptMaxWords}`));
  });

  it("includes strict rules", () => {
    const session = createCoolerSession("basement noise", ["Alice"]);
    const prompt = buildTurnPrompt(session, "Alice", "ask");
    assert.ok(prompt.includes("STRICT RULES"));
    assert.ok(prompt.includes("NO quotes"));
  });

  it("includes conversation history when present", () => {
    const session = createCoolerSession("basement noise", ["Alice", "Bob"]);
    const u = mkUtterance("Alice", "Did anyone hear that?", "ask");
    session.utterances.push(u);
    addUtteranceToHistory(session, u);

    const prompt = buildTurnPrompt(session, "Bob", "answer");
    assert.ok(prompt.includes("Did anyone hear that?"));
    assert.ok(prompt.includes("LAST MESSAGE"));
  });
});

// ── Config sanity ────────────────────────────────────────────────────

describe("maxWords vs promptMaxWords", () => {
  it("promptMaxWords < maxWords (intentional slack for small models)", () => {
    assert.ok(
      COOLER_CONFIG.promptMaxWords < COOLER_CONFIG.maxWords,
      "prompt target should be lower than hard reject limit",
    );
  });

  it("maxWords is 15 and promptMaxWords is 12 (current defaults)", () => {
    assert.equal(COOLER_CONFIG.maxWords, 15);
    assert.equal(COOLER_CONFIG.promptMaxWords, 12);
  });
});
