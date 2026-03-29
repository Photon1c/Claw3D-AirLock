import { Agent, AgentStatus, AgentMood, Task, TaskStatus, ConversationContext } from "../types";
import { CHAIR_POSITIONS, WANDER_POINTS, ZONE_CONFIG } from "./layout";

const MOOD_EMOJIS: Record<AgentMood, string> = {
  happy: "😊",
  neutral: "😐",
  thinking: "🤔",
  excited: "🤩",
  tired: "😴",
  frustrated: "😤",
};

const MOOD_THOUGHTS: Record<AgentMood, string[]> = {
  happy: ["Great day!", "Feeling good!", "Love this vibe"],
  neutral: ["So it goes...", "Just another day", "Hmm..."],
  thinking: ["Interesting...", "Need to ponder this", "What if..."],
  excited: ["Can't wait!", "This is awesome!", "New ideas!"],
  tired: ["Need coffee...", "So sleepy...", "Almost done"],
  frustrated: ["Not working...", "Why??", "This is hard"],
};

export const MOOD_OPTIONS: AgentMood[] = ["happy", "neutral", "thinking", "excited", "tired", "frustrated"];

export const ZONE_MOODS: Record<string, AgentMood[]> = {
  lobby: ["happy", "neutral"],
  kitchen: ["happy", "excited", "neutral"],
  openOffice: ["neutral", "thinking", "tired"],
  archives: ["thinking", "neutral"],
  executive: ["thinking", "neutral", "excited"],
  specialist: ["thinking", "excited", "frustrated"],
  conference: ["thinking", "neutral"],
  gym: ["happy", "excited", "neutral"],
  missionControl: ["thinking", "excited", "tired"],
};

export function getConversationContext(zoneId: string): ConversationContext {
  const config = ZONE_CONFIG[zoneId];
  return {
    location: zoneId,
    mood: config?.mood || "neutral",
    intensity: config?.intensity || "medium",
    participants: [],
  };
}

export function getLocationAwareMood(zoneId: string): AgentMood {
  const moods = ZONE_MOODS[zoneId] || ["neutral"];
  return moods[Math.floor(Math.random() * moods.length)];
}

export function getLocationAwareThoughts(zoneId: string): string[] {
  const locationThoughts: Record<string, string[]> = {
    lobby: ["Welcome!", "Who's here?", "Hello there!"],
    kitchen: ["Coffee break!", "Anyone want coffee?", "Nice weather!", "Did you see that?"],
    openOffice: ["Getting work done...", "So much to do...", "Deadline coming..."],
    archives: ["Looking back...", "Historical records...", "Found something interesting..."],
    executive: ["Strategic planning...", "Big decisions...", "The bottom line..."],
    specialist: ["Analyzing...", "Deep work...", "Pattern recognition..."],
    conference: ["Let's discuss...", "Agenda items...", "Moving on..."],
    gym: ["Feeling strong!", "Good workout!", "Clear mind..."],
    missionControl: ["All systems go!", "Telemetry looks good...", "Watch that anomaly..."],
  };
  
  return locationThoughts[zoneId] || ["Hmm..."];
}

export const INITIAL_AGENTS: Agent[] = [
  {
    id: "frontdesk",
    name: "FrontDesk",
    color: "#b4b4c4",
    role: "receptionist",
    status: "working",
    mood: "neutral",
    x: 125,
    y: 410,
    targetX: CHAIR_POSITIONS[0].x,
    targetY: CHAIR_POSITIONS[0].y,
    dir: "right",
    frame: 0,
    mode: "sitting",
    deskIndex: 0,
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    color: "#3498db",
    role: "clerk",
    status: "working",
    mood: "neutral",
    x: 430,
    y: 350,
    targetX: CHAIR_POSITIONS[1].x,
    targetY: CHAIR_POSITIONS[1].y,
    dir: "left",
    frame: 0,
    mode: "walking",
    deskIndex: 1,
  },
  {
    id: "ironclaw",
    name: "IronClaw",
    color: "#4ecdc4",
    role: "custodian",
    status: "working",
    mood: "thinking",
    x: 770,
    y: 350,
    targetX: CHAIR_POSITIONS[2].x,
    targetY: CHAIR_POSITIONS[2].y,
    dir: "right",
    frame: 0,
    mode: "walking",
    deskIndex: 2,
  },
  {
    id: "hermitclaw",
    name: "HermitClaw",
    color: "#9b59b6",
    role: "archivist",
    status: "working",
    mood: "excited",
    x: 1075,
    y: 615,
    targetX: CHAIR_POSITIONS[3].x,
    targetY: CHAIR_POSITIONS[3].y,
    dir: "right",
    frame: 0,
    mode: "walking",
    deskIndex: 3,
  },
  {
    id: "leslieclaw",
    name: "LeslieClaw",
    color: "#e74c3c",
    role: "executive",
    status: "idle",
    mood: "happy",
    x: 150,
    y: 110,
    targetX: CHAIR_POSITIONS[4].x,
    targetY: CHAIR_POSITIONS[4].y,
    dir: "right",
    frame: 0,
    mode: "idle-wander",
    deskIndex: 4,
  },
  {
    id: "zeroclaw",
    name: "ZeroClaw",
    color: "#ff6b6b",
    role: "specialist",
    status: "idle",
    mood: "thinking",
    x: 400,
    y: 110,
    targetX: CHAIR_POSITIONS[5].x,
    targetY: CHAIR_POSITIONS[5].y,
    dir: "left",
    frame: 0,
    mode: "idle-wander",
    deskIndex: 5,
  },
  {
    id: "sherlobster",
    name: "Sherlobster",
    color: "#f39c12",
    role: "specialist",
    status: "working",
    mood: "happy",
    x: 500,
    y: 110,
    targetX: CHAIR_POSITIONS[6].x,
    targetY: CHAIR_POSITIONS[6].y,
    dir: "left",
    frame: 0,
    mode: "walking",
    deskIndex: 6,
  },
  {
    id: "hercule-prawnro",
    name: "Hercule Prawnro",
    color: "#9b59b6",
    role: "specialist",
    status: "working",
    mood: "excited",
    x: 600,
    y: 110,
    targetX: CHAIR_POSITIONS[7].x,
    targetY: CHAIR_POSITIONS[7].y,
    dir: "right",
    frame: 0,
    mode: "walking",
    deskIndex: 7,
  },
];

export function updateAgentPosition(
  agent: Agent,
  speed: number,
  deltaTime: number
): Agent {
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 4) {
    if (agent.mode === "walking") {
      return {
        ...agent,
        mode: "sitting",
        x: agent.targetX,
        y: agent.targetY,
      };
    }
    return agent;
  }

  const moveX = (dx / distance) * speed * (deltaTime / 16);
  const moveY = (dy / distance) * speed * (deltaTime / 16);

  const newDir = dx > 0 ? "right" : "left";
  const newFrame: 0 | 1 = agent.frame === 0 ? 1 : 0;

  return {
    ...agent,
    x: agent.x + moveX,
    y: agent.y + moveY,
    dir: newDir,
    frame: newFrame,
  };
}

export function updateAgentStatus(
  agent: Agent,
  newStatus: AgentStatus
): Agent {
  if (agent.status === newStatus) return agent;

  if (newStatus === "working") {
    const target = CHAIR_POSITIONS[agent.deskIndex];
    return {
      ...agent,
      status: newStatus,
      targetX: target.x,
      targetY: target.y,
      mode: "walking",
    };
  } else {
    const randomPoint =
      WANDER_POINTS[Math.floor(Math.random() * WANDER_POINTS.length)];
    return {
      ...agent,
      status: newStatus,
      targetX: randomPoint.x,
      targetY: randomPoint.y,
      mode: "idle-wander",
    };
  }
}

let wanderTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

export function handleWanderLogic(agent: Agent): Agent {
  if (agent.status !== "idle" || agent.mode !== "idle-wander") {
    return agent;
  }

  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 10) {
    if (!wanderTimeouts.has(agent.id)) {
      const timeout = setTimeout(() => {
        const newPoint =
          WANDER_POINTS[Math.floor(Math.random() * WANDER_POINTS.length)];
        wanderTimeouts.delete(agent.id);
        agent.x = newPoint.x;
        agent.y = newPoint.y;
      }, 2000 + Math.random() * 3000);
      wanderTimeouts.set(agent.id, timeout);
    }
  }

  return agent;
}

export function createMockStatusUpdater(
  agents: Agent[],
  setAgents: (agents: Agent[]) => void,
  interval: number
): () => void {
  const intervalId = setInterval(() => {
    setAgents(
      agents.map((agent) => {
        const randomStatus: AgentStatus =
          Math.random() > 0.5 ? "working" : "idle";
        return updateAgentStatus(agent, randomStatus);
      })
    );
  }, interval);

  return () => clearInterval(intervalId);
}

export function getMoodEmoji(mood: AgentMood): string {
  return MOOD_EMOJIS[mood];
}

export function getRandomThought(mood: AgentMood): string {
  const thoughts = MOOD_THOUGHTS[mood];
  return thoughts[Math.floor(Math.random() * thoughts.length)];
}

export function updateAgentMood(agent: Agent, newMood: AgentMood): Agent {
  return { ...agent, mood: newMood };
}

export function generateThoughtBubble(agent: Agent): Agent {
  const thoughtText = getRandomThought(agent.mood);
  return {
    ...agent,
    thoughtBubble: {
      text: thoughtText,
      expiresAt: Date.now() + 3000 + Math.random() * 2000,
    },
  };
}

export function clearExpiredThoughts(agent: Agent): Agent {
  if (agent.thoughtBubble && agent.thoughtBubble.expiresAt < Date.now()) {
    return { ...agent, thoughtBubble: undefined };
  }
  return agent;
}

// ============================================================================
// Task Packet System (per role_patch.md)
// ============================================================================

function generatePacketId(): string {
  return `pkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createTaskPacket(
  workflowType: string,
  creatorRole: string,
  requester: string = "user",
  summary: string = ""
): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: generatePacketId(),
    workflowType,
    createdAt: now,
    createdBy: creatorRole,
    requester,
    status: "queued",
    priority: "normal",
    currentOwner: creatorRole,
    recommendedNextOwner: undefined,
    requiresReview: true,
    requiresExecutive: false,
    summary,
    inputs: {},
    worklog: [
      {
        timestamp: now,
        agent: creatorRole,
        action: "ticket_created",
        note: "Structured intake packet created.",
      },
    ],
    artifacts: [],
    decision: undefined,
    response: undefined,
    archive: {
      logRequired: true,
      recordClass: "generic_task",
    },
  };

  return task;
}

export function receptionistUpdate(
  task: Task,
  summary: string,
  inputs: Record<string, any>
): Task {
  const currentWorklog = task.worklog || [];
  return {
    ...task,
    summary,
    inputs: { ...(task.inputs || {}), ...inputs },
    recommendedNextOwner: "clerk",
    worklog: [
      ...currentWorklog,
      {
        timestamp: new Date().toISOString(),
        agent: "receptionist",
        action: "ticket_created",
        note: `Extracted: ${summary}`,
      },
    ],
  };
}

export function clerkUpdate(
  task: Task,
  nextOwner: string,
  status: TaskStatus = "in_progress"
): Task {
  const currentWorklog = task.worklog || [];
  return {
    ...task,
    currentOwner: nextOwner,
    status,
    worklog: [
      ...currentWorklog,
      {
        timestamp: new Date().toISOString(),
        agent: "clerk",
        action: "assigned",
        note: `Assigned to ${nextOwner}`,
      },
    ],
  };
}

export function specialistUpdate(
  task: Task,
  decisionSummary: string,
  approved: boolean = true
): Task {
  const currentWorklog = task.worklog || [];
  return {
    ...task,
    decision: {
      review_result: approved ? "approved" : "rejected",
      summary: decisionSummary,
    },
    recommendedNextOwner: "clerk",
    worklog: [
      ...currentWorklog,
      {
        timestamp: new Date().toISOString(),
        agent: "specialist",
        action: "reviewed",
        note: decisionSummary,
      },
    ],
  };
}

export function archivistCommit(task: Task): Task {
  const currentWorklog = task.worklog || [];
  return {
    ...task,
    status: "archived",
    worklog: [
      ...currentWorklog,
      {
        timestamp: new Date().toISOString(),
        agent: "archivist",
        action: "archived",
        note: "Final record commit.",
      },
    ],
  };
}

export const TASK_STATUSES: TaskStatus[] = [
  "queued",
  "in_progress",
  "awaiting_review",
  "approved",
  "escalated",
  "ready_for_delivery",
  "completed",
  "archived",
  "failed",
];

export const ACTION_VERBS: string[] = [
  "ticket_created",
  "assigned",
  "repo_checked",
  "report_created",
  "reviewed",
  "approved",
  "escalated",
  "response_prepared",
  "delivered",
  "archived",
  "failed",
];
