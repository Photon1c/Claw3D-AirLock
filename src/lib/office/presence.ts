import type { OfficeAgentState } from "@/lib/office/schema";

export type OfficeAgentPresence = {
  agentId: string;
  name: string;
  state: OfficeAgentState;
  preferredDeskId?: string;
};

export type OfficePresenceSnapshot = {
  workspaceId: string;
  timestamp: string;
  agents: OfficeAgentPresence[];
};

export const loadOfficePresenceSnapshot = (
  workspaceId: string,
  agents: OfficeAgentPresence[] = []
): OfficePresenceSnapshot => {
  const timestamp = new Date().toISOString();
  return {
    workspaceId,
    timestamp,
    agents,
  };
};
