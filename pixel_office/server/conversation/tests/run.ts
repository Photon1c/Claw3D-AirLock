/**
 * CLI runner — exercises the Cooler Talk engine without the server.
 *
 * Usage:  npx tsx server/conversation/tests/run.ts
 *         npx tsx server/conversation/tests/run.ts "your custom topic"
 *         npx tsx server/conversation/tests/run.ts "topic" --location kitchen
 */

import {
  createCoolerSession,
  validateUtterance,
  getNextIntent,
  addUtteranceToHistory,
  getRepairText,
  buildTurnPrompt,
  sessionToMarkdown,
} from "../coolerController";
import { serializeSession } from "../persistence/serialize";
import { COOLER_CONFIG } from "../config";
import type { Utterance } from "../types";

// ── Parse CLI args ──────────────────────────────────────────────────
let topic = "basement noise";
let location: string | undefined;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--location" && args[i + 1]) {
    location = args[++i];
  } else if (!args[i].startsWith("--")) {
    topic = args[i];
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log(`  Cooler Talk Engine — CLI Runner`);
console.log(`  Topic: "${topic}"`);
if (location) console.log(`  Location: ${location}`);
console.log(`  Config: maxWords=${COOLER_CONFIG.maxWords} prompt=${COOLER_CONFIG.promptMaxWords} similarity=${COOLER_CONFIG.similarityThreshold}`);
console.log("═══════════════════════════════════════════════════════════\n");

const session = createCoolerSession({
  topic,
  participants: ["FrontDesk", "IronClaw", "Sherlobster", "OpenClaw", "LeslieClaw"],
  location,
});

console.log(`Session: ${session.id}`);
console.log(`Keywords: [${session.topicKeywords.join(", ")}]`);
console.log(`Participants: ${session.participants.join(", ")}`);
if (session.location) console.log(`Location: ${session.location}`);
console.log();

const SIMULATED_LINES: Utterance[] = [
  { speaker: "FrontDesk",   text: "Did anyone hear that noise from the basement?",        intent: "ask",      replyTo: null },
  { speaker: "IronClaw",    text: "Yeah, that basement noise sounded heavier than usual",  intent: "answer",   replyTo: 0 },
  { speaker: "Sherlobster",  text: "If that basement noise is alive, I'm leaving",          intent: "joke",     replyTo: 1 },
  { speaker: "OpenClaw",    text: "Should we check if maintenance logged that?",            intent: "redirect", replyTo: 2 },
  { speaker: "LeslieClaw",  text: "Yeah, tracking that makes sense",                       intent: "agree",    replyTo: 3 },
  { speaker: "IronClaw",    text: "We should inspect before it worsens",                   intent: "escalate", replyTo: 4 },
];

let passed = 0;
let failed = 0;
let repaired = 0;

for (let i = 0; i < SIMULATED_LINES.length; i++) {
  const line = SIMULATED_LINES[i];
  const prevUtterances = session.utterances.slice();
  const intent = getNextIntent(session);

  const result = validateUtterance(line, session, prevUtterances);
  const status = result.valid ? "PASS" : "FAIL";

  if (result.valid) {
    passed++;
  } else {
    failed++;
  }

  console.log(`  Turn ${i + 1}: [${status}] ${line.speaker} (${line.intent})`);
  console.log(`    "${line.text}"`);
  if (!result.valid) {
    console.log(`    Reasons: ${result.rejected_reasons.join(", ")}`);

    const repair = getRepairText(line.intent, topic, prevUtterances[prevUtterances.length - 1]?.text);
    console.log(`    Repair:  "${repair}"`);
    repaired++;

    const repairUtterance: Utterance = {
      speaker: line.speaker,
      text: repair,
      intent: line.intent,
      replyTo: line.replyTo,
    };
    const repairResult = validateUtterance(repairUtterance, session, prevUtterances);
    console.log(`    Repair validation: ${repairResult.valid ? "PASS" : "FAIL " + repairResult.rejected_reasons.join(", ")}`);

    session.utterances.push(repairUtterance);
    session.validationDetails.push(repairResult);
    addUtteranceToHistory(session, repairUtterance);
  } else {
    session.utterances.push(line);
    session.validationDetails.push(result);
    addUtteranceToHistory(session, line);
  }
  session.currentTurn++;
}

console.log("\n───────────────────────────────────────────────────────────");
console.log(`  Results: ${passed} passed, ${failed} failed, ${repaired} repaired`);
console.log("───────────────────────────────────────────────────────────\n");

// Show a sample prompt for the next turn
console.log("── Sample prompt for next turn ──\n");
const nextIntent = getNextIntent(session);
const nextSpeaker = session.participants[session.currentTurn % session.participants.length];
const prompt = buildTurnPrompt(session, nextSpeaker, nextIntent);
console.log(prompt);

// Session JSON
console.log("\n── Serialized session (JSON snippet) ──\n");
const serialized = serializeSession(session);
const jsonStr = JSON.stringify(serialized, null, 2);
const lines = jsonStr.split("\n");
if (lines.length > 30) {
  console.log(lines.slice(0, 28).join("\n"));
  console.log(`  ... (${lines.length - 28} more lines)`);
} else {
  console.log(jsonStr);
}

// Session markdown
console.log("\n── Session markdown ──\n");
console.log(sessionToMarkdown(session));
