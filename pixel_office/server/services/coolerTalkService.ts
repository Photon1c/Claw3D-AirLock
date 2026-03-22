import { createCoolerSession, runNextTurn, exportSession, serializeSession, deserializeSession } from "../conversation/api.js";
import { type CoolerSession, type TurnResult, type ConversationExport, type GenerateFn, type Utterance } from "../conversation/types.js";
import { COOLER_CONFIG } from "../conversation/config.js";
import { getTopicForConversation } from "./newsTopics.js";
import * as fs from "fs";
import * as path from "path";

// Define the sessions directory
const SESSIONS_DIR = path.resolve("data/cooler_sessions");

// Ensure the directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Get the file path for a given location
 */
function getSessionFilePath(location: string): string {
  // Sanitize location to be filesystem-safe
  const safeLocation = location.replace(/[^\w\-]/g, "_");
  return path.join(SESSIONS_DIR, `${safeLocation}.json`);
}

/**
 * Load a session for a given location, or create a new one if none exists
 */
export function loadOrCreateSession(location: string, createOptions: Partial<{ topic: string; participants: string[] }> = {}): CoolerSession {
  const filePath = getSessionFilePath(location);
  
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      const session = deserializeSession(JSON.parse(data));
      // Ensure location is set (backward compatibility)
      if (!session.location) {
        session.location = location;
      }
      return session;
    } catch (error) {
      console.error(`Failed to load session for ${location}:`, error);
      // Fall through to create a new session
    }
  }
  
  // Create a new session
  const session = createCoolerSession({
    ...createOptions,
    location, // Always set location
  });
  
  // Persist the new session
  persistSession(session);
  
  return session;
}

/**
 * Persist a session to disk
 */
export function persistSession(session: CoolerSession): void {
  const filePath = getSessionFilePath(session.location);
  const serialized = serializeSession(session);
  fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), "utf8");
}

/**
 * Compute a target position within the kitchen for an agent index.
 * Spreads agents in a grid inside the kitchen area.
 */
function computeKitchenPosition(agentIndex: number, totalParticipants: number): { x: number; y: number } {
  // Kitchen bounds from layout.ts (hardcoded for now, could import)
  const kitchenX = 960;
  const kitchenY = 10;
  const kitchenWidth = 230;
  const kitchenHeight = 230;
  
  // Padding from walls
  const padX = 30;
  const padY = 30;
  const usableWidth = kitchenWidth - 2 * padX;
  const usableHeight = kitchenHeight - 2 * padY;
  
  // Grid layout: up to 4 columns
  const cols = 4;
  const col = agentIndex % cols;
  const row = Math.floor(agentIndex / cols);
  
  const cellWidth = usableWidth / cols;
  const cellHeight = usableHeight / Math.ceil(totalParticipants / cols);
  
  const x = kitchenX + padX + col * cellWidth + cellWidth / 2;
  const y = kitchenY + padY + row * cellHeight + cellHeight / 2;
  
  return { x, y };
}

/**
 * Run a turn for a given location, generating a multi-turn conversation
 * where each participant gets a turn to speak (by assigning the utterance to them).
 */
export async function runRoomTurn(
  location: string,
  options: {
    topic?: string;
    participants?: string[];
    userMessage?: string;
    generateFn: GenerateFn;
  }
): Promise<{ 
  turnResult: TurnResult; 
  session: CoolerSession; 
  assignments: { agentId: string; targetX: number; targetY: number }[];
  dialogues: { agentId: string; text: string; showAt: number; expiresAt: number }[];
  participantCount;
}> {
  // Load or create session
  const session = loadOrCreateSession(location, {
    topic: options.topic,
    participants: options.participants,
  });
  
  const participants = options.participants || [];
  let topic = options.topic || "";
  
  // Use news topics if no topic specified or if "auto"
  if (!topic || topic === "auto" || topic === "news") {
    topic = getTopicForConversation();
  }
  
  const participantCount = participants.length;
  
  // Prepare results
  const assignments: { agentId: string; targetX: number; targetY: number }[] = [];
  const dialogues: { agentId: string; text: string; showAt: number; expiresAt: number }[] = [];
  
  // We will generate a turn for each participant in order.
  // For each participant, we run a turn to get an utterance (from the engine),
  // then we assign that utterance to the participant (by setting the speaker to the participant).
  // This way each participant gets an utterance to say.
  let lastTurnResult: TurnResult | null = null;
  
  for (let i = 0; i < participantCount; i++) {
    const participant = participants[i];
    
    // Run a turn to get an utterance (engine decides based on internal state)
    const turnResult = await runNextTurn(session, options.generateFn);
    lastTurnResult = turnResult;
    const { utterance } = turnResult;
    
    // Create a new utterance with the same text and intent but speaker set to the participant
    const assignedUtterance: Utterance = {
      ...utterance,
      speaker: participant, // override speaker to be the participant
    };
    
    // Compute target position for this participant
    const { x, y } = computeKitchenPosition(i, participantCount);
    assignments.push({
      agentId: participant.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-"),
      targetX: x,
      targetY: y,
    });
    
    // Create a dialogue entry for this utterance
    // We'll stagger the dialogues: each starts 2 seconds after the previous, each visible for 5 seconds
    const showAt = Date.now() + i * 2000;
    const expiresAt = showAt + 5000;
    
    dialogues.push({
      agentId: participant.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-"),
      text: assignedUtterance.text,
      showAt,
      expiresAt,
    });
  }
  
  // Persist the session after we have generated all utterances
  persistSession(session);
  
  // If we have at least one turn result, use the last one; otherwise, create a dummy.
  const turnResultToReturn = lastTurnResult !== null ? lastTurnResult : 
    { utterance: { speaker: "", text: "", intent: "" as any, replyTo: null }, 
      validation: { valid: true, retries: 0, rejected_reasons: [] }, 
      repaired: false, 
      intent: "" as any };
  
  return {
    turnResult: turnResultToReturn,
    session,
    assignments,
    dialogues,
    participantCount
  };
}

/**
 * Export a session for a given location
 */
export function exportRoomSession(location: string): { markdown: string; json: any } | null {
  const filePath = getSessionFilePath(location);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const serialized = JSON.parse(data);
    const session = deserializeSession(serialized);
    const exportData = exportSession(session);
    return exportData;
  } catch (error) {
    console.error(`Failed to export session for ${location}:`, error);
    return null;
  }
}