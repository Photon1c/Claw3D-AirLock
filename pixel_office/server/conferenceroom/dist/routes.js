import { Router } from "express";
import { generateRoomId, generateEventId, getCurrentUtc, } from "./models.js";
export function createConferenceRoomRouter(storage) {
    const router = Router();
    // POST /conferenceroom/agent/checkin
    router.post("/agent/checkin", (req, res) => {
        const data = req.body || {};
        const agentId = data.agent_id;
        if (!agentId) {
            return res.status(400).json({ ok: false, error: "agent_id required" });
        }
        const existingAgent = storage.getAgent(agentId);
        if (existingAgent) {
            if (data.display_name)
                existingAgent.display_name = data.display_name;
            if (data.role)
                existingAgent.role = data.role;
            if (data.status)
                existingAgent.status = data.status;
            if (data.capabilities)
                existingAgent.capabilities = data.capabilities;
            existingAgent.last_checkin_utc = getCurrentUtc();
            storage.upsertAgent(existingAgent);
            console.log(`[Conferenceroom] Agent check-in received: ${agentId}`);
            return res.json({ ok: true, agent: existingAgent });
        }
        else {
            const newAgent = {
                agent_id: agentId,
                display_name: data.display_name || agentId,
                role: data.role || "",
                status: data.status || "available",
                capabilities: data.capabilities || [],
                last_checkin_utc: getCurrentUtc(),
            };
            storage.upsertAgent(newAgent);
            console.log(`[Conferenceroom] Agent check-in received: ${agentId}`);
            return res.json({ ok: true, agent: newAgent });
        }
    });
    // GET /conferenceroom/agents
    router.get("/agents", (req, res) => {
        const status = req.query.status;
        const agents = storage.listAgents(status);
        res.json({ agents });
    });
    // POST /conferenceroom/rooms
    router.post("/rooms", (req, res) => {
        const data = req.body || {};
        const title = data.title || "Untitled Room";
        const agentIds = data.agents || [];
        const agendaData = data.agenda || [];
        const agenda = agendaData.map((item) => ({
            episode_id: item.episode_id || "",
            label: item.label || "",
            status: "pending",
        }));
        const room = {
            room_id: generateRoomId(),
            title,
            status: "open",
            created_utc: getCurrentUtc(),
            agents: agentIds,
            agenda,
        };
        storage.upsertRoom(room);
        console.log(`[Conferenceroom] Room created: ${room.room_id}`);
        res.json({ room });
    });
    // GET /conferenceroom/rooms
    router.get("/rooms", (req, res) => {
        const status = req.query.status;
        const rooms = storage.listRooms(status);
        res.json({ rooms });
    });
    // GET /conferenceroom/rooms/:room_id
    router.get("/rooms/:room_id", (req, res) => {
        const roomId = req.params.room_id;
        const room = storage.getRoom(roomId);
        if (!room) {
            return res.status(404).json({ ok: false, error: "Room not found" });
        }
        const events = storage.getRoomEvents(roomId);
        res.json({ room, events });
    });
    // POST /conferenceroom/rooms/:room_id/status
    router.post("/rooms/:room_id/status", (req, res) => {
        const roomId = req.params.room_id;
        const data = req.body || {};
        const status = data.status;
        if (!status) {
            return res.status(400).json({ ok: false, error: "status required" });
        }
        const room = storage.getRoom(roomId);
        if (!room) {
            return res.status(404).json({ ok: false, error: "Room not found" });
        }
        room.status = status;
        storage.upsertRoom(room);
        res.json({ ok: true, room });
    });
    // POST /conferenceroom/rooms/:room_id/events
    router.post("/rooms/:room_id/events", (req, res) => {
        const roomId = req.params.room_id;
        const data = req.body || {};
        const room = storage.getRoom(roomId);
        if (!room) {
            return res.status(404).json({ ok: false, error: "Room not found" });
        }
        const event = {
            event_id: generateEventId(),
            room_id: roomId,
            agent_id: data.agent_id || "",
            timestamp_utc: getCurrentUtc(),
            event_type: data.event_type || "NOTE",
            payload: data.payload || {},
        };
        storage.insertEvent(event);
        if (event.event_type === "EPISODE_RESULT") {
            const payload = event.payload;
            const episodeId = payload.episode_id;
            if (episodeId) {
                for (const item of room.agenda) {
                    if (item.episode_id === episodeId) {
                        item.status = payload.status === "completed" ? "completed" : "failed";
                        storage.upsertRoom(room);
                        break;
                    }
                }
            }
            console.log(`[Conferenceroom] Episode result posted: ${episodeId}`);
        }
        res.json({ ok: true, event });
    });
    // POST /conferenceroom/checkin (upgrade-beta style)
    router.post("/checkin", (req, res) => {
        const data = req.body || {};
        const agentId = data.agent_id;
        if (!agentId) {
            return res.status(400).json({ ok: false, error: "agent_id required" });
        }
        const existingAgent = storage.getAgent(agentId);
        const now = data.ts;
        if (existingAgent) {
            if (now)
                existingAgent.last_checkin_utc = now;
            if (data.capabilities)
                existingAgent.capabilities = data.capabilities;
            if (data.status && typeof data.status === "object") {
                const statusObj = data.status;
                existingAgent.status = statusObj.ok === false ? "busy" : "available";
            }
            storage.upsertAgent(existingAgent);
        }
        else {
            const newAgent = {
                agent_id: agentId,
                display_name: agentId,
                role: "",
                status: "available",
                capabilities: data.capabilities || [],
                last_checkin_utc: now,
            };
            storage.upsertAgent(newAgent);
        }
        console.log(`[Conferenceroom] Checkin received: ${agentId}`);
        res.json({ ok: true, instructions: [], next_poll_sec: 20 });
    });
    // POST /conferenceroom/report (upgrade-beta style)
    router.post("/report", (req, res) => {
        const data = req.body || {};
        const agentId = data.agent_id;
        const jobId = data.job_id;
        if (!agentId || !jobId) {
            return res.status(400).json({ ok: false, error: "agent_id and job_id required" });
        }
        console.log(`[Conferenceroom] Report from ${agentId}: job=${jobId}, ok=${data.ok}`);
        res.json({ ok: true });
    });
    return router;
}
