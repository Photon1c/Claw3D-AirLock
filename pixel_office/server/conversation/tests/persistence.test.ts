import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  serializeSession,
  deserializeSession,
  SESSION_VERSION,
} from "../persistence/serialize";
import { createCoolerSession } from "../coolerController";
import type {
  CoolerSession,
  SerializedSession,
  Utterance,
  ValidationResult,
} from "../types";

function addTurn(
  session: CoolerSession,
  speaker: string,
  text: string,
  intent: Utterance["intent"],
  validation: ValidationResult,
) {
  const u: Utterance = {
    speaker,
    text,
    intent,
    replyTo: session.utterances.length > 0 ? session.utterances.length - 1 : null,
  };
  session.utterances.push(u);
  session.validationDetails.push(validation);
  session.usedPhrases.add(text.toLowerCase());
  session.conversationHistory.push(`${speaker}: "${text}"`);
  session.currentTurn++;
}

function buildPopulatedSession(location?: string): CoolerSession {
  const opts = location
    ? { topic: "basement noise", participants: ["Alice", "Bob"], location }
    : "basement noise";
  const parts = location ? undefined : ["Alice", "Bob"];

  const session = location
    ? createCoolerSession({ topic: "basement noise", participants: ["Alice", "Bob"], location })
    : createCoolerSession("basement noise", ["Alice", "Bob"]);

  addTurn(session, "Alice", "Did anyone hear that basement noise?", "ask", {
    valid: true,
    retries: 0,
    rejected_reasons: [],
  });

  addTurn(session, "Bob", "Yeah, the basement noise was loud", "answer", {
    valid: true,
    retries: 1,
    rejected_reasons: [],
  });

  addTurn(session, "Alice", "I agree, the basement noise is concerning", "agree", {
    valid: false,
    retries: 3,
    rejected_reasons: ["too_similar"],
  });

  return session;
}

describe("serializeSession", () => {
  it("produces valid JSON with required fields", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);

    assert.ok(json.id.startsWith("ct-"));
    assert.equal(json.version, SESSION_VERSION);
    assert.equal(json.topic, "basement noise");
    assert.deepEqual(json.participants.sort(), ["Alice", "Bob"]);
    assert.equal(json.utterances.length, 3);
    assert.ok(Array.isArray(json.topicKeywords));
  });

  it("includes validation details per utterance", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);

    assert.equal(json.utterances[0].validation?.valid, true);
    assert.equal(json.utterances[0].validation?.retries, 0);
    assert.equal(json.utterances[2].validation?.valid, false);
    assert.deepEqual(json.utterances[2].validation?.rejected_reasons, ["too_similar"]);
  });

  it("includes location when present", () => {
    const session = buildPopulatedSession("kitchen");
    const json = serializeSession(session);
    assert.equal(json.location, "kitchen");
  });

  it("omits location when absent", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);
    assert.equal(json.location, undefined);
  });

  it("includes startedAt timestamp", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);
    assert.ok(json.startedAt);
  });

  it("round-trips through JSON.stringify/parse cleanly", () => {
    const session = buildPopulatedSession("lobby");
    const json = serializeSession(session);
    const roundTripped = JSON.parse(JSON.stringify(json));
    assert.deepEqual(roundTripped, json);
  });
});

describe("deserializeSession", () => {
  it("reconstructs a usable CoolerSession", () => {
    const session = buildPopulatedSession("kitchen");
    const json = serializeSession(session);
    const restored = deserializeSession(json);

    assert.equal(restored.topic, "basement noise");
    assert.equal(restored.location, "kitchen");
    assert.equal(restored.utterances.length, 3);
    assert.equal(restored.currentTurn, 3);
    assert.equal(restored.conversationHistory.length, 3);
    assert.ok(restored.usedPhrases instanceof Set);
    assert.equal(restored.usedPhrases.size, 3);
  });

  it("rebuilds usedPhrases from utterances", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);
    const restored = deserializeSession(json);

    assert.ok(restored.usedPhrases.has("did anyone hear that basement noise?"));
    assert.ok(restored.usedPhrases.has("yeah, the basement noise was loud"));
  });

  it("rebuilds conversationHistory from utterances", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);
    const restored = deserializeSession(json);

    assert.ok(restored.conversationHistory[0].includes("Alice"));
    assert.ok(restored.conversationHistory[1].includes("Bob"));
  });

  it("restores validationDetails correctly", () => {
    const session = buildPopulatedSession();
    const json = serializeSession(session);
    const restored = deserializeSession(json);

    assert.equal(restored.validationDetails[0].valid, true);
    assert.equal(restored.validationDetails[2].valid, false);
    assert.deepEqual(restored.validationDetails[2].rejected_reasons, ["too_similar"]);
  });
});

describe("round-trip: serialize → deserialize → serialize", () => {
  it("produces equivalent structures", () => {
    const session = buildPopulatedSession("conference_room_1");
    const json1 = serializeSession(session);
    const restored = deserializeSession(json1);
    const json2 = serializeSession(restored);

    assert.equal(json1.id, json2.id);
    assert.equal(json1.topic, json2.topic);
    assert.equal(json1.location, json2.location);
    assert.deepEqual(json1.utterances, json2.utterances);
    assert.deepEqual(json1.topicKeywords.sort(), json2.topicKeywords.sort());
    assert.deepEqual(json1.participants.sort(), json2.participants.sort());
  });
});

describe("backwards compatibility", () => {
  it("handles missing optional fields gracefully", () => {
    const minimal: SerializedSession = {
      id: "ct-legacy",
      version: "cooler_v1",
      topic: "old topic",
      participants: ["A", "B"],
      topicKeywords: ["old", "topic"],
      utterances: [
        {
          speaker: "A",
          text: "hello about old topic",
          intent: "observe",
          replyTo: null,
        },
      ],
    };

    const session = deserializeSession(minimal);
    assert.equal(session.topic, "old topic");
    assert.equal(session.location, undefined);
    assert.equal(session.startedAt, undefined);
    assert.equal(session.utterances.length, 1);
    assert.equal(session.validationDetails[0].valid, true);
    assert.equal(session.validationDetails[0].retries, 0);
  });

  it("ignores unknown extra fields in input", () => {
    const withExtras = {
      id: "ct-future",
      version: "cooler_v3",
      topic: "future topic",
      participants: ["X"],
      topicKeywords: ["future", "topic"],
      utterances: [],
      unknownField: "should be ignored",
      anotherNew: 42,
    } as unknown as SerializedSession;

    const session = deserializeSession(withExtras);
    assert.equal(session.topic, "future topic");
    assert.equal(session.utterances.length, 0);
  });

  it("handles utterances without validation block", () => {
    const noValidation: SerializedSession = {
      id: "ct-noval",
      version: "cooler_v2",
      topic: "test topic",
      participants: ["A"],
      topicKeywords: ["test", "topic"],
      utterances: [
        {
          speaker: "A",
          text: "some words about test topic",
          intent: "observe",
          replyTo: null,
        },
      ],
    };

    const session = deserializeSession(noValidation);
    assert.equal(session.validationDetails[0].valid, true);
    assert.equal(session.validationDetails[0].retries, 0);
    assert.deepEqual(session.validationDetails[0].rejected_reasons, []);
  });
});
