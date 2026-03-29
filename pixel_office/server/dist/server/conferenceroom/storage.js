export class ConferenceRoomStorage {
    constructor() {
        this.agents = new Map();
        this.rooms = new Map();
        this.events = new Map();
    }
    upsertAgent(agent) {
        this.agents.set(agent.agent_id, agent);
    }
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    listAgents(status) {
        const all = Array.from(this.agents.values());
        if (status) {
            return all.filter((a) => a.status === status);
        }
        return all;
    }
    upsertRoom(room) {
        this.rooms.set(room.room_id, room);
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    listRooms(status) {
        const all = Array.from(this.rooms.values());
        if (status) {
            return all.filter((r) => r.status === status);
        }
        return all;
    }
    getOpenRoomsWithPendingEpisodes() {
        const rooms = this.listRooms();
        return rooms.filter((room) => {
            if (room.status !== "open" && room.status !== "in_progress")
                return false;
            return room.agenda.some((item) => item.status === "pending");
        });
    }
    insertEvent(event) {
        const roomEvents = this.events.get(event.room_id) || [];
        roomEvents.push(event);
        this.events.set(event.room_id, roomEvents);
    }
    getRoomEvents(roomId, limit = 100) {
        const events = this.events.get(roomId) || [];
        return events.slice(-limit).reverse();
    }
}
