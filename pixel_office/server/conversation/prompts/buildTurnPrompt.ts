/**
 * Prompt builder for Cooler Talk turns.
 *
 * Assembles the model-facing prompt from session state, personality,
 * and intent requirements. Kept separate from the controller so it
 * can be tested and tuned independently.
 */

import type { ConversationIntent, CoolerSession } from "../types";
import { COOLER_CONFIG } from "../config";
import { getPersonality } from "../agentPersonalities";

const INTENT_INSTRUCTIONS: Record<ConversationIntent, string> = {
  ask:      "Your line MUST be a QUESTION with '?'. Ask about the topic or what was just said.",
  answer:   "Your line MUST respond to the previous message. Reference what was said. Do NOT ask a question.",
  observe:  "Your line MUST mention something about the topic directly.",
  joke:     "Your line MUST be a joke related to the topic or what was just said.",
  agree:    "Your line MUST say you agree. Use words like 'yeah', 'true', 'exactly', 'good point'.",
  disagree: "Your line MUST politely disagree and offer a different view.",
  redirect: "Your line MUST introduce a related point while referencing topic or previous line.",
  escalate: "Your line MUST add urgency or importance. Say why it matters now.",
};

export function buildTurnPrompt(
  session: CoolerSession,
  agentName: string,
  requiredIntent: ConversationIntent,
): string {
  const personality = getPersonality(agentName);
  const lastUtterance = session.utterances[session.utterances.length - 1];

  let history = `WATER COOLER CONVERSATION about: "${session.topic}"`;
  if (session.location) {
    history += ` (at the ${session.location})`;
  }
  history += "\n";
  for (let i = 0; i < session.conversationHistory.length; i++) {
    history += `${i + 1}. ${session.conversationHistory[i]}\n`;
  }

  let previousContext: string;
  if (lastUtterance) {
    previousContext = `\nLAST MESSAGE: "${lastUtterance.text}" (said by ${lastUtterance.speaker})`;
    previousContext += `\nYou MUST directly respond to what ${lastUtterance.speaker} just said!`;
  } else {
    previousContext = `\nYou are starting this conversation about "${session.topic}".`;
  }

  let personalityContext = "";
  if (personality) {
    personalityContext = `
Your character: ${agentName} (${personality.role})
Style: ${personality.speech_style}
Speak naturally as this person!`;
  }

  return `${history}${previousContext}${personalityContext}

REQUIRED INTENT: "${requiredIntent}"
${INTENT_INSTRUCTIONS[requiredIntent]}

STRICT RULES:
- You MUST reference the topic OR what was just said
- Maximum ${COOLER_CONFIG.promptMaxWords} words
- Write as natural speech, not narration  
- NO quotes around your response
- If you ignore these rules, your response will be rejected!`;
}
