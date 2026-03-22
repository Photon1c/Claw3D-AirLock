/**
 * Layout utilities for Pixel Office
 * 
 * Optional: Use tilemap from models/tilemap_adapter.ts
 * Set USE_TILEMAP = true to enable
 */

import { Agent } from "../types";

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;
export const STATUS_BAR_HEIGHT = 80;
export const TILE_SIZE = 20;

export const COLORS = {
  floorDark: "#050814",
  floorLight: "#0a1023",
  wall: "#1b2333",
  wallBorder: "#2a3548",
  desk: "#3d3225",
  deskTop: "#4a3d2e",
  monitorFrame: "#1a1a2e",
  monitorScreen: "#2f7fff",
  monitorScreenOff: "#1a1a2e",
  statusWorking: "#00ff88",
  statusIdle: "#ff4b4b",
  statusBarBg: "#050509",
  white: "#e8e8e8",
  couch: "#6b3a5b",
  couchAccent: "#8b4a6b",
  waterCooler: "#4a6b8a",
  waterTank: "#5a8bba",
  plantGreen: "#2d5a3d",
  plantTrunk: "#4a3020",
  bookshelf: "#5a4535",
  books: ["#8b4a6b", "#4a6b8a", "#6b5a4a", "#4a8b5a", "#8b6b4a"],
  fridge: "#d0d0d0",
  fridgeHandle: "#888888",
  coffeeMachine: "#2a2a2a",
  pingPongTable: "#2a5a3a",
  pingPongLine: "#ffffff",
  beanBag: "#5a4a6b",
  whiteboard: "#d8d8d8",
  whiteboardBorder: "#888888",
  indicatorGlow: "#00ff88",
  indicatorBusy: "#ffcc00",
};

export const ROOMS = {
  executive: { x: 10, y: 10, width: 280, height: 200, label: "Executive Suite", zoneId: "exec_suite" },
  specialist: { x: 310, y: 10, width: 380, height: 200, label: "Specialist Suites", zoneId: "specialist_suite" },
  conference: { x: 710, y: 10, width: 230, height: 200, label: "Conference Room", zoneId: "conference" },
  kitchen: { x: 960, y: 10, width: 230, height: 230, label: "Kitchen & Cooler", zoneId: "kitchen" },
  lobby: { x: 10, y: 230, width: 230, height: 360, label: "Lobby & Reception", zoneId: "lobby" },
  archives: { x: 960, y: 520, width: 230, height: 190, label: "Archives & Records", zoneId: "archives" },
  gym: { x: 10, y: 610, width: 230, height: 100, label: "Gym & Wellness", zoneId: "gym" },
  openOffice: { x: 260, y: 230, width: 680, height: 420, label: "Open Office", zoneId: "open_office" },
  missionControl: { x: 710, y: 230, width: 230, height: 270, label: "Mission Control", zoneId: "mission_control" },
};

export const ZONE_CONFIG: Record<string, { mood: string; intensity: "high" | "medium" | "low"; color: string }> = {
  lobby: { mood: "welcoming", intensity: "medium", color: "#b4a87c" },
  kitchen: { mood: "casual", intensity: "low", color: "#4a6b8a" },
  openOffice: { mood: "operational", intensity: "medium", color: "#605848" },
  archives: { mood: "reflective", intensity: "low", color: "#7c6c56" },
  executive: { mood: "strategic", intensity: "high", color: "#d2b95a" },
  specialist: { mood: "analytical", intensity: "high", color: "#966ed2" },
  conference: { mood: "focused", intensity: "high", color: "#5a8cd2" },
  gym: { mood: "relaxed", intensity: "low", color: "#64b46e" },
  missionControl: { mood: "intense", intensity: "high", color: "#be5050" },
};

export function getZoneAtPosition(x: number, y: number): string | null {
  for (const [zoneId, room] of Object.entries(ROOMS)) {
    if (x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height) {
      return zoneId;
    }
  }
  return null;
}

export function getZoneForAgent(agent: Agent): string {
  return getZoneAtPosition(agent.x, agent.y) || "unknown";
}

export const CUBICLE_WIDTH = 120;
export const CUBICLE_HEIGHT = 100;

export const CUBICLE_POSITIONS = [
  { x: 40, y: 350 },     // Lobby (Reception Desk)
  { x: 330, y: 350 },    // Open Office 1
  { x: 650, y: 350 },    // Open Office 2
  { x: 1000, y: 580 },   // Archives
  { x: 80, y: 80 },      // Executive
  { x: 340, y: 80 },     // Specialist 1
  { x: 480, y: 80 },     // Specialist 2
  { x: 620, y: 80 },     // Specialist 3
];

export const DESK_POSITIONS = CUBICLE_POSITIONS.map((pos) => ({
  x: pos.x + CUBICLE_WIDTH / 2 - 30,
  y: pos.y + CUBICLE_HEIGHT / 2 - 20,
}));

export const CHAIR_POSITIONS = CUBICLE_POSITIONS.map((pos) => ({
  x: pos.x + CUBICLE_WIDTH / 2 - 10,
  y: pos.y + CUBICLE_HEIGHT / 2 + 10,
}));

export const WANDER_POINTS = [
  { x: 125, y: 410 },   // Lobby
  { x: 600, y: 460 },   // Open Office
  { x: 1075, y: 130 },  // Kitchen
  { x: 1075, y: 615 },  // Archives
  { x: 150, y: 110 },   // Exec
  { x: 500, y: 110 },   // Specialist
  { x: 825, y: 110 },   // Conference
  { x: 125, y: 660 },   // Gym
];

export const KITCHEN_COOLER_POINTS = [
  { x: 1040, y: 80 },
  { x: 1110, y: 80 },
  { x: 1040, y: 140 },
  { x: 1110, y: 140 },
  { x: 1075, y: 110 },
  { x: 1075, y: 170 },
];

export const CONFERENCE_ROOM_POINTS = [
  { x: 730, y: 90 },
  { x: 780, y: 90 },
  { x: 830, y: 90 },
  { x: 880, y: 90 },
  { x: 730, y: 140 },
  { x: 780, y: 140 },
  { x: 830, y: 140 },
  { x: 880, y: 140 },
];

export const ROLE_DESK_ITEMS: Record<string, string> = {
  receptionist: "bell",
  clerk: "clipboard",
  executive: "briefcase",
  specialist: "microscope",
  custodian: "wrench",
  archivist: "book",
};

// ============================================================================
// Tilemap Integration (Optional - set USE_TILEMAP = true to enable)
// ============================================================================

export const USE_TILEMAP = false;

// Tilemap dimensions and tile size
export const TM_TILE_SIZE = 32;
export const TM_MAP_WIDTH = 40;
export const TM_MAP_HEIGHT = 24;

// Tilemap grid (zone key at end of file)

// Zone anchors for agent routing
export const TM_ZONE_ANCHORS = {
  "R": { x: 15, y: 9 },
  "E": { x: 4, y: 4 },
  "S": { x: 28, y: 4 },
  "C": { x: 15, y: 13 },
  "I": { x: 4, y: 20 },
  "A": { x: 30, y: 20 },
};

// Zone labels
export const TM_ZONE_LABELS: Record<string, string> = {
  "R": "Reception",
  "E": "Executive",
  "S": "Specialist",
  "C": "Clerk Hub",
  "I": "Infrastructure",
  "A": "Archive",
};

// Role colors from template models
export const TM_ROLE_COLORS: Record<string, string> = {
  "receptionist": "#b4b4c4",
  "executive": "#d2b95a",
  "specialist": "#966ed2",
  "clerk": "#78b4dc",
  "custodian": "#d2a050",
  "archive": "#a0c88c",
};

// Role icons from template models  
export const TM_ROLE_ICONS: Record<string, string> = {
  "receptionist": "🛎️",
  "executive": "💼",
  "specialist": "🧤",
  "archive": "📚",
  "clerk": "📊",
  "custodian": "🔧",
};

// Tilemap colors
export const TM_COLORS: Record<string, string> = {
  "W": "#3a322e",
  "R": "#b4a87c",
  "H": "#786854",
  "E": "#6e563e",
  "S": "#4e6052",
  "C": "#605848",
  "I": "#524e46",
  "A": "#7c6c56",
  "D": "#aa842c",
  "BG": "#201c1a",
  "GRID": "#2d2824",
  "TEXT": "#ebe1cd",
  "PACKET": "#ffda60",
  "PACKET_GLOW": "#fff2aa",
  "STATUS_IDLE": "#968c78",
  "STATUS_ROUTE": "#5a8cd2",
  "STATUS_MAINT": "#d2a050",
  "STATUS_ANALYZE": "#966ed2",
  "STATUS_EXEC": "#d2b95a",
  "STATUS_DONE": "#64b46e",
  "STATUS_BLOCKED": "#be5050",
};

// Tilemap grid data
export const TM_TILEMAP: string[] = [
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WEEEEEEEEEEEHHHHHHHHHHSSSSSSSSSSSSSSSSSW",
  "WHHHHHHHHHHHDDDDDDDDDDHHHHHHHHHHHHHHHHHW",
  "WHHHHHHHHHHHDDDDDDDDDDHHHHHHHHHHHHHHHHHW",
  "WCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCW",
  "WCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCW",
  "WCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCW",
  "WCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCW",
  "WHHHHHHHHHHHDDDDDDDDDDHHHHHHHHHHHHHHHHHW",
  "WHHHHHHHHHHHDDDDDDDDDDHHHHHHHHHHHHHHHHHW",
  "WIIIIIIIIIIIIHHHHHHHHHHAAAAAAAAAAAAAAAHW",
  "WIIIIIIIIIIIIHHHHHHHHHHAAAAAAAAAAAAAAAHW",
  "WIIIIIIIIIIIIHHHHHHHHHHAAAAAAAAAAAAAAAHW",
  "WIIIIIIIIIIIIHHHHHHHHHHAAAAAAAAAAAAAAAHW",
  "WIIIIIIIIIIIIHHHHHHHHHHAAAAAAAAAAAAAAAHW",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
];

// Helper functions for tilemap
export function tmGetTileAt(tx: number, ty: number): string {
  if (ty < 0 || ty >= TM_TILEMAP.length || tx < 0 || tx >= TM_TILEMAP[0].length) {
    return "W";
  }
  return TM_TILEMAP[ty][tx];
}

export function tmIsWalkable(tx: number, ty: number): boolean {
  return tmGetTileAt(tx, ty) !== "W";
}

export function tmGetZoneForTile(tx: number, ty: number): string {
  const tile = tmGetTileAt(tx, ty);
  const zoneMap: Record<string, string> = {
    "R": "Reception",
    "E": "Executive",
    "S": "Specialist",
    "C": "Clerk Hub",
    "I": "Infrastructure",
    "A": "Archive",
    "D": "Pipeline",
    "H": "Hallway",
    "W": "Wall",
  };
  return zoneMap[tile] || "Unknown";
}

export function tmGetZoneAnchor(zone: string): { x: number; y: number } | null {
  return (TM_ZONE_ANCHORS as any)[zone] || null;
}

export function tmTileToScreen(tx: number, ty: number): { x: number; y: number } {
  return {
    x: tx * TM_TILE_SIZE,
    y: ty * TM_TILE_SIZE
  };
}

export function tmScreenToTile(sx: number, sy: number): { x: number; y: number } {
  return {
    x: Math.floor(sx / TM_TILE_SIZE),
    y: Math.floor(sy / TM_TILE_SIZE)
  };
}
