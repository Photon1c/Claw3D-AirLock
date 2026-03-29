import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCoolerSession,
  runNextTurn,
  runSession,
  exportSession,
  serializeSession,
  deserializeSession,
} from "../api";

describe("createCoolerSession (options overload)", () => {
  it("creates a session with location", () => {
    const session = createCoolerSession({
      topic: "basement noise",
      participants: ["Alice", "Bob"],
      location: "kitchen",
    });

    assert.equal(session.topic, "basement noise");
    assert.equal(session.location, "kitchen");
    assert.ok(session.startedAt);
    assert.equal(session.utterances.length, 0);
  });

  it("creates a session without location (backwards compat)", () => {
    const session = createCoolerSession({
      topic: "office wifi",
      participants: ["Carol", "Dan"],
    });

    assert.equal(session.topic, "office wifi");
    assert.equal(session.location, undefined);
  });
});

describe("runNextTurn", () => {
  it("runs a turn without generateFn (repair mode)", async () => {
    const session = createCoolerSession({
      topic: "basement noise",
      participants: ["Alice", "Bob"],
    });

    const result = await runNextTurn(session);

    assert.ok(result.utterance);
    assert.ok(result.utterance.text.length > 0);
    assert.ok(result.intent);
    assert.equal(result.repaired, true);
    assert.equal(session.utterances.length, 1);
    assert.equal(session.currentTurn, 1);
  });

  it("runs multiple turns building a valid conversation", async () => {
    const session = createCoolerSession({
      topic: "basement noise",
      participants: ["Alice", "Bob"],
      location: "kitchen",
    });

    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await runNextTurn(session));
    }

    assert.equal(session.utterances.length, 6);
    assert.equal(session.currentTurn, 6);
    assert.equal(session.location, "kitchen");

    for (const r of results) {
      assert.ok(r.utterance.text.length > 0);
      assert.ok(r.intent);
    }
  });

  it("uses generateFn when provided", async () => {
    const session = createCoolerSession({
      topic: "basement noise",
      participants: ["Alice"],
    });

    const mockGenerate = async (_prompt: string) =>
      "Did anyone hear the basement noise lately?";

    const result = await runNextTurn(session, mockGenerate);
    assert.equal(result.utterance.text, "Did anyone hear the basement noise lately?");
    assert.equal(result.repaired, false);
  });

  it("falls back to repair when generateFn returns invalid text", async () => {
    const session = createCoolerSession({
      topic: "basement noise",
      participants: ["Alice"],
    });

    const mockGenerate = async (_prompt: string) =>
      "This has absolutely nothing to do with anything relevant at all whatsoever";

    const result = await runNextTurn(session, mockGenerate);
    assert.equal(result.repaired, true);
  });
});

describe("runSession", () => {
  it("runs a full session with repair-only turns", async () => {
    const session = await runSession(
      { topic: "basement noise", participants: ["Alice", "Bob"], location: "lobby" },
      5,
    );

    assert.equal(session.utterances.length, 5);
    assert.equal(session.location, "lobby");
    assert.equal(session.currentTurn, 5);
  });
});

describe("exportSession", () => {
  it("returns both markdown and json", async () => {
    const session = await runSession(
      { topic: "basement noise", participants: ["Alice", "Bob"], location: "kitchen" },
      4,
    );

    const exported = exportSession(session);

    assert.ok(exported.markdown.includes("basement noise"));
    assert.ok(exported.markdown.includes("kitchen"));
    assert.ok(exported.markdown.includes("Alice") || exported.markdown.includes("Bob"));

    assert.equal(exportedon.topic, "basement noise");
    assert.equal(exportedon.location, "kitchen");
    assert.equal(exportedon.utterances.length, 4);
  });

  it("json matches serializeSession output", async () => {
    const session = await runSession(
      { topic: "office wifi", participants: ["Carol", "Dan"] },
      3,
    );

    const exported = exportSession(session);
    const direct = serializeSession(session);

    assert.deepEqual(exportedon, direct);
  });
});

describe("location propagation end-to-end", () => {
  it("location survives create → run → serialize → deserialize → export", async () => {
    const session = createCoolerSession({
      topic: "basement noise",
      participants: ["Alice", "Bob"],
      location: "exec_suite",
    });

    for (let i = 0; i < 4; i++) {
      await runNextTurn(session);
    }

    const serialized = serializeSession(session);
    assert.equal(serialized.location, "exec_suite");

    const restored = deserializeSession(serialized);
    assert.equal(restored.location, "exec_suite");

    const exported = exportSession(restored);
    assert.equal(exportedon.location, "exec_suite");
    assert.ok(exported.markdown.includes("exec_suite"));
  });

  it("no-location session remains locationless throughout pipeline", async () => {
    const session = await runSession(
      { topic: "office wifi", participants: ["Carol"] },
      3,
    );

    const serialized = serializeSession(session);
    assert.equal(serialized.location, undefined);

    const restored = deserializeSession(serialized);
    assert.equal(restored.location, undefined);

    const exported = exportSession(restored);
    assert.equal(exportedon.location, undefined);
    assert.ok(!exported.markdown.includes("Location:"));
  });
});
