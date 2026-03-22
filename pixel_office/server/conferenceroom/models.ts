export type AgentStatus = "available" | "busy" | "offline";
export type RoomStatus = "open" | "in_progress" | "closed";
export type AgendaItemStatus = "pending" | "running" | "completed" | "failed";
export type EventType = "CHECKIN" | "NOTE" | "EPISODE_ASSIGNED" | "EPISODE_RESULT";

export interface AgendaItem {
  episode_id: string;
  label: string;
  status: AgendaItemStatus;
}

export interface Agent {
  agent_id: string;
  display_name: string;
  role: string;
  status: AgentStatus;
  capabilities: string[];
  last_checkin_utc: string;
  x: number;
  y: number;
}

export interface Room {
  room_id: string;
  title: string;
  status: RoomStatus;
  created_utc: string;
  agents: string[];
  agenda: AgendaItem[];
}

export interface Event {
  event_id: string;
  room_id: string;
  agent_id: string;
  timestamp_utc: string;
  event_type: EventType;
  payload: Record<string, unknown>;
}

export function generateRoomId(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `conf-${dateStr}-${randomPart}`;
}

export function generateEventId(): string {
  return `evt-${Math.random().toString(36).substring(2, 10)}`;
}

export function getCurrentUtc(): string {
  return new Date().toISOString();
}
