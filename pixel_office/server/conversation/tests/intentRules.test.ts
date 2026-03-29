import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkIntentRules } from "../validation/intentRules";

describe("ask intent", () => {
  it("valid: has question mark", () => {
    const r = checkIntentRules("ask", "Did anyone hear that noise?");
    assert.ok(r.valid);
  });

  it("valid: has interrogative word without question mark", () => {
    const r = checkIntentRules("ask", "Who left the door open");
    assert.ok(r.valid);
  });

  it("valid: 'does' counts as interrogative", () => {
    const r = checkIntentRules("ask", "Does anyone know about that");
    assert.ok(r.valid);
  });

  it("invalid: no question mark and no interrogative", () => {
    const r = checkIntentRules("ask", "I think the noise stopped");
    assert.ok(!r.valid);
    assert.equal(r.reason, "ask_without_question_marker");
  });
});

describe("answer intent", () => {
  it("valid: statement without question mark", () => {
    const r = checkIntentRules("answer", "Yeah I heard it too");
    assert.ok(r.valid);
  });

  it("invalid: contains question mark", () => {
    const r = checkIntentRules("answer", "Did you mean that one?");
    assert.ok(!r.valid);
    assert.equal(r.reason, "answer_contains_question");
  });
});

describe("agree intent", () => {
  it("valid: contains 'yeah'", () => {
    const r = checkIntentRules("agree", "Yeah that makes sense");
    assert.ok(r.valid);
  });

  it("valid: contains 'exactly'", () => {
    const r = checkIntentRules("agree", "Exactly what I was thinking");
    assert.ok(r.valid);
  });

  it("valid: contains 'good point'", () => {
    const r = checkIntentRules("agree", "That's a good point about noise");
    assert.ok(r.valid);
  });

  it("valid: contains 'right'", () => {
    const r = checkIntentRules("agree", "Right, that noise is odd");
    assert.ok(r.valid);
  });

  it("valid: contains 'definitely'", () => {
    const r = checkIntentRules("agree", "Definitely noticed that too");
    assert.ok(r.valid);
  });

  it("invalid: no agreement signal", () => {
    const r = checkIntentRules("agree", "The noise was loud");
    assert.ok(!r.valid);
    assert.equal(r.reason, "agree_without_agreement_signal");
  });
});

describe("disagree intent", () => {
  it("valid: contains 'not sure'", () => {
    const r = checkIntentRules("disagree", "I'm not sure about that noise");
    assert.ok(r.valid);
  });

  it("valid: contains 'differently'", () => {
    const r = checkIntentRules("disagree", "I see it differently actually");
    assert.ok(r.valid);
  });

  it("valid: contains 'doubt'", () => {
    const r = checkIntentRules("disagree", "I doubt that noise matters");
    assert.ok(r.valid);
  });

  it("invalid: no disagreement signal", () => {
    const r = checkIntentRules("disagree", "The noise was loud");
    assert.ok(!r.valid);
    assert.equal(r.reason, "disagree_without_disagreement_signal");
  });
});

describe("escalate intent", () => {
  it("valid: contains 'should'", () => {
    const r = checkIntentRules("escalate", "We should check the basement now");
    assert.ok(r.valid);
  });

  it("valid: contains 'urgent'", () => {
    const r = checkIntentRules("escalate", "This basement issue is urgent");
    assert.ok(r.valid);
  });

  it("valid: contains 'need to'", () => {
    const r = checkIntentRules("escalate", "We need to address this noise");
    assert.ok(r.valid);
  });

  it("valid: contains 'gotta'", () => {
    const r = checkIntentRules("escalate", "We gotta fix that basement thing");
    assert.ok(r.valid);
  });

  it("invalid: no urgency signal", () => {
    const r = checkIntentRules("escalate", "The noise was loud yesterday");
    assert.ok(!r.valid);
    assert.equal(r.reason, "escalate_without_urgency_signal");
  });
});

describe("joke/observe/redirect intents", () => {
  it("joke always passes intent check", () => {
    const r = checkIntentRules("joke", "Literally anything goes here");
    assert.ok(r.valid);
  });

  it("observe always passes intent check", () => {
    const r = checkIntentRules("observe", "Literally anything goes here");
    assert.ok(r.valid);
  });

  it("redirect always passes intent check", () => {
    const r = checkIntentRules("redirect", "Literally anything goes here");
    assert.ok(r.valid);
  });
});
