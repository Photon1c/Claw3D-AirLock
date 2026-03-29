/**
 * Cooler Talk Conversation Controller - Phase 2
 *
 * Strict intent validation, topic anchoring, and anti-repetition.
 * Enforces semantic correctness in conversations.
 */
import { getPersonality } from "./agentPersonalities.js";
// Simple fuzzy match for anti-repetition
function fuzzyMatch(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 && intersection / union > 0.7;
}
// Extract keywords from topic
function extractTopicKeywords(topic) {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'about', 'from', 'or', 'and', 'if', 'to', 'in', 'on', 'at', 'who', 'what', 'why', 'how', 'when', 'where', 'whether', 'that', 'this']);
    return topic.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
}
// Extract keywords from previous line
function extractLineKeywords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'you', 'we', 'they', 'it', 'this', 'that', 'to', 'and', 'or', 'but']);
    return text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
}
// Check topic anchoring
function hasKeywordOverlap(text, topicKeywords, prevKeywords) {
    const textLower = text.toLowerCase();
    const hasTopic = topicKeywords.some(k => textLower.includes(k));
    const hasPrev = prevKeywords.some(k => textLower.includes(k));
    return hasTopic || hasPrev;
}
// Intent sequence rules
const INTENT_SEQUENCE = {
    first: ["ask", "observe"],
    afterAsk: ["answer", "agree", "disagree", "joke"],
    afterAnswer: ["joke", "redirect", "agree", "observe"],
    afterJoke: ["observe", "ask", "agree", "redirect"],
    afterAgree: ["observe", "redirect", "ask"],
    afterDisagree: ["answer", "observe", "joke"],
    afterObserve: ["answer", "ask", "joke", "agree"],
    afterRedirect: ["agree", "observe", "answer"],
    closing: ["redirect", "agree", "escalate"],
};
function getAllowedIntents(utterances, turnIndex) {
    if (turnIndex === 0)
        return INTENT_SEQUENCE.first;
    const lastUtterance = utterances[turnIndex - 1];
    const remainingParticipants = utterances.length > 0 ? utterances.length - (turnIndex - 1) : 3;
    if (remainingParticipants <= 1)
        return INTENT_SEQUENCE.closing;
    switch (lastUtterance.intent) {
        case "ask": return INTENT_SEQUENCE.afterAsk;
        case "answer": return INTENT_SEQUENCE.afterAnswer;
        case "joke": return INTENT_SEQUENCE.afterJoke;
        case "agree": return INTENT_SEQUENCE.afterAgree;
        case "disagree": return INTENT_SEQUENCE.afterDisagree;
        case "observe": return INTENT_SEQUENCE.afterObserve;
        case "redirect": return INTENT_SEQUENCE.afterRedirect;
        default: return INTENT_SEQUENCE.afterObserve;
    }
}
function needsQuestion(utterances) {
    return !utterances.some(u => u.intent === "ask");
}
function needsAnswer(utterances) {
    const askIndex = utterances.findIndex(u => u.intent === "ask");
    if (askIndex === -1)
        return false;
    return !utterances.slice(askIndex).some(u => u.intent === "answer" || u.intent === "agree" || u.intent === "disagree");
}
// Repair templates - deterministic fallback
const REPAIR_TEMPLATES = {
    ask: (topic) => `Did anyone else notice the ${topic}?`,
    answer: (_, prev) => prev ? `Yes, I think you're right about that.` : `I think so too.`,
    observe: (topic) => `The ${topic} seems different today.`,
    joke: (topic) => `At least the ${topic} keeps things interesting!`,
    agree: (_, prev) => prev ? `Exactly, that's a good point.` : `I totally agree.`,
    disagree: (_, prev) => prev ? `I'm not sure I see it that way.` : `Hmm, I think differently.`,
    redirect: (topic) => `Speaking of ${topic}, should we check on that?`,
    escalate: (topic) => `We should really address the ${topic} situation!`,
};
export function createCoolerSession(topic, participants) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    return {
        id: `ct-${Date.now()}`,
        topic,
        topicKeywords: extractTopicKeywords(topic),
        participants: shuffled,
        utterances: [],
        currentTurn: 0,
        conversationHistory: [],
        usedPhrases: new Set(),
        validationDetails: [],
    };
}
export function buildTurnPrompt(session, agentName, requiredIntent) {
    const personality = getPersonality(agentName);
    const lastUtterance = session.utterances[session.utterances.length - 1];
    let history = `WATER COOLER CONVERSATION about: "${session.topic}"\n`;
    session.conversationHistory.forEach((line, i) => {
        history += `${i + 1}. ${line}\n`;
    });
    let previousContext = "";
    const prevKeywords = lastUtterance ? extractLineKeywords(lastUtterance.text) : [];
    if (lastUtterance) {
        previousContext = `\nLAST MESSAGE: "${lastUtterance.text}" (said by ${lastUtterance.speaker})`;
        previousContext += `\nYou MUST directly respond to what ${lastUtterance.speaker} just said!`;
    }
    else {
        previousContext = `\nYou are starting this conversation about "${session.topic}".`;
    }
    // Strict intent instructions
    const intentInstructions = {
        ask: "Your line MUST be a QUESTION with '?'. Ask about the topic or what was just said.",
        answer: "Your line MUST respond to the previous message. Reference what was said. Do NOT ask a question.",
        observe: "Your line MUST mention something about the topic directly.",
        joke: "Your line MUST be a joke related to the topic or what was just said.",
        agree: "Your line MUST say you agree. Use words like 'yeah', 'true', 'exactly', 'good point'.",
        disagree: "Your line MUST politely disagree and offer a different view.",
        redirect: "Your line MUST introduce a related point while referencing topic or previous line.",
        escalate: "Your line MUST add urgency or importance. Say why it matters now.",
    };
    let personalityContext = "";
    if (personality) {
        personalityContext = `
Your character: ${agentName} (${personality.role})
Style: ${personality.speech_style}
Speak naturally as this person!`;
    }
    return `${history}${previousContext}${personalityContext}

REQUIRED INTENT: "${requiredIntent}"
${intentInstructions[requiredIntent]}

STRICT RULES:
- You MUST reference the topic OR what was just said
- Maximum 12 words
- Write as natural speech, not narration  
- NO quotes around your response
- If you ignore these rules, your response will be rejected!`;
}
export function validateUtterance(utterance, session, allUtterances) {
    const reasons = [];
    let valid = true;
    const text = utterance.text;
    const wordCount = text.split(/\s+/).length;
    // 1. Word count check
    if (wordCount > 15) {
        reasons.push("too_long");
        valid = false;
    }
    if (wordCount < 2) {
        reasons.push("too_short");
        valid = false;
    }
    // 2. Strict Intent Validation
    switch (utterance.intent) {
        case "ask":
            if (!text.includes("?") && !/\b(who|what|why|how|when|where|does|did|is|are|can|could|should|would)\b/i.test(text)) {
                reasons.push("ask_without_question_mark");
                valid = false;
            }
            break;
        case "answer":
            if (text.includes("?")) {
                reasons.push("answer_is_question");
                valid = false;
            }
            break;
        case "agree":
            const agreeWords = /\b(yeah|yes|true|exactly|good point|i agree|totally|absolutely|certainly)\b/i;
            if (!agreeWords.test(text)) {
                reasons.push("agree_without_agreement_signal");
                valid = false;
            }
            break;
        case "escalate":
            const urgencyWords = /\b(should|need to|must|important|serious|urgent|right now|ASAP|quick|critical)\b/i;
            if (!urgencyWords.test(text)) {
                reasons.push("escalate_without_urgency");
                valid = false;
            }
            break;
        case "joke":
            // Jokes are looser but should still reference topic/prev
            break;
    }
    // 3. Topic Anchoring - CRITICAL
    const lastUtterance = allUtterances[allUtterances.length - 1];
    const prevKeywords = lastUtterance ? extractLineKeywords(lastUtterance.text) : [];
    if (!hasKeywordOverlap(text, session.topicKeywords, prevKeywords)) {
        reasons.push("no_topic_or_prev_reference");
        valid = false;
    }
    // 4. Anti-Repetition
    const textLower = text.toLowerCase();
    if (session.usedPhrases.has(textLower)) {
        reasons.push("duplicate_line");
        valid = false;
    }
    // Check fuzzy duplicates
    for (const used of session.usedPhrases) {
        if (fuzzyMatch(textLower, used)) {
            reasons.push("too_similar_to_previous");
            valid = false;
            break;
        }
    }
    // Check against all utterances in session
    for (const u of allUtterances) {
        if (u.text.toLowerCase() === textLower) {
            reasons.push("already_said");
            valid = false;
            break;
        }
    }
    return { valid, retries: 0, rejected_reasons: reasons };
}
export function getNextIntent(session) {
    const allowed = getAllowedIntents(session.utterances, session.currentTurn);
    if (needsQuestion(session.utterances) && allowed.includes("ask")) {
        return "ask";
    }
    if (needsAnswer(session.utterances) && allowed.includes("answer")) {
        return "answer";
    }
    return allowed[Math.floor(Math.random() * allowed.length)];
}
export function addUtteranceToHistory(session, utterance) {
    session.conversationHistory.push(`${utterance.speaker}: "${utterance.text}"`);
    session.usedPhrases.add(utterance.text.toLowerCase());
}
export function getRepairText(intent, topic, prevText) {
    const templateFn = REPAIR_TEMPLATES[intent];
    return templateFn(topic, prevText);
}
export function serializeSessionLog(session) {
    return session.utterances.map((u, i) => {
        const details = session.validationDetails[i];
        const retryInfo = details ? ` (valid: ${details.valid}, retries: ${details.retries})` : "";
        return `- **${u.speaker}** (${u.intent}${u.replyTo !== null ? `, reply_to: ${u.replyTo}` : ''}): ${u.text}${retryInfo}`;
    }).join("\n");
}
export function sessionToMarkdown(session) {
    return `
## Cooler Talk Session - ${session.id}

**Topic:** ${session.topic}
**Keywords:** ${session.topicKeywords.join(", ")}
**Participants:** ${session.participants.join(", ")}

### Dialogue

${serializeSessionLog(session)}
---
`;
}
