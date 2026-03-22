import { Agent } from "../types";

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  tags: string[];
  models: {
    primary: {
      name: string;
      provider: string;
      endpoint?: string;
      status: "local-ready" | "local-unavailable" | "remote";
    };
    fallback: {
      name: string;
      provider: string;
      status: "remote";
    };
  };
  status: "active" | "disabled" | "experimental";
  meta: {
    version: number;
    updatedAt: string;
    app: string;
  };
}

let cachedAgentCards: AgentCard[] | null = null;

export async function loadAgentCards(): Promise<AgentCard[]> {
  if (cachedAgentCards) {
    return cachedAgentCards;
  }

  try {
    const response = await fetch("/handoff/opencode-local-agents.json", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`Failed to load agent cards: ${response.status}`);
      return [];
    }

    const data = await response.json();
    cachedAgentCards = data as AgentCard[];
    return cachedAgentCards;
  } catch (error) {
    console.warn("Error loading agent cards:", error);
    return [];
  }
}

export function getAgentCardForRuntimeAgent(
  agent: Agent,
  agentCards: AgentCard[]
): AgentCard | undefined {
  return agentCards.find((card) => card.id === agent.id);
}

export function mergeRuntimeWithCards(
  runtimeAgents: Agent[],
  agentCards: AgentCard[]
): (Agent & { agentCard?: AgentCard })[] {
  return runtimeAgents.map((agent) => ({
    ...agent,
    agentCard: getAgentCardForRuntimeAgent(agent, agentCards),
  }));
}

export function getModelStatusForAgent(
  agentCards: AgentCard[],
  agentId: string
): { primary: string; fallback: string } | null {
  const card = agentCards.find((c) => c.id === agentId);
  if (!card || !card.models) return null;

  return {
    primary: card.models.primary?.status || "remote",
    fallback: card.models.fallback?.status || "remote",
  };
}

export function invalidateAgentCardsCache(): void {
  cachedAgentCards = null;
}
