import type { Agent, Room, Event, AgentStatus, RoomStatus, AgendaItem } from "./models.js";

export class ConferenceRoomStorage {
  private agents: Map<string, Agent> = new Map();
  private rooms: Map<string, Room> = new Map();
  private events: Map<string, Event[]> = new Map();

  upsertAgent(agent: Agent): void {
    this.agents.set(agent.agent_id, agent);
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  listAgents(status?: AgentStatus): Agent[] {
    const all = Array.from(this.agents.values());
    if (status) {
      return all.filter((a) => a.status === status);
    }
    return all;
  }

  upsertRoom(room: Room): void {
    this.rooms.set(room.room_id, room);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(status?: RoomStatus): Room[] {
    const all = Array.from(this.rooms.values());
    if (status) {
      return all.filter((r) => r.status === status);
    }
    return all;
  }

  getOpenRoomsWithPendingEpisodes(): Room[] {
    const rooms = this.listRooms();
    return rooms.filter((room) => {
      if (room.status !== "open" && room.status !== "in_progress") return false;
      return room.agenda.some((item) => item.status === "pending");
    });
  }

  insertEvent(event: Event): void {
    const roomEvents = this.events.get(event.room_id) || [];
    roomEvents.push(event);
    this.events.set(event.room_id, roomEvents);
  }

  getRoomEvents(roomId: string, limit: number = 100): Event[] {
    const events = this.events.get(roomId) || [];
    return events.slice(-limit).reverse();
  }
}
