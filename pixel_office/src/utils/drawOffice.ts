import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  STATUS_BAR_HEIGHT,
  COLORS,
  ROOMS,
  CUBICLE_POSITIONS,
  CUBICLE_WIDTH,
  CUBICLE_HEIGHT,
  ZONE_CONFIG,
} from "./layout";
import { AgentVisibility, ZoneActivity } from "../types";

export function drawPlants(ctx: CanvasRenderingContext2D): void {
  drawPlant(ctx, 270, 240);
  drawPlant(ctx, 920, 240);
  drawPlant(ctx, 270, 630);
  drawPlant(ctx, 920, 630);
  
  const clockX = 1150;
  const clockY = 400;
  const clockRadius = 20;
  
  ctx.fillStyle = "#1a2535";
  ctx.beginPath();
  ctx.arc(clockX, clockY, clockRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a5a6a";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  const now = new Date();
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  const hX = clockX + Math.cos((hours * 30 - 90) * Math.PI / 180) * 8;
  const hY = clockY + Math.sin((hours * 30 - 90) * Math.PI / 180) * 8;
  ctx.lineTo(hX, hY);
  ctx.stroke();
  
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  const mX = clockX + Math.cos((minutes * 6 - 90) * Math.PI / 180) * 12;
  const mY = clockY + Math.sin((minutes * 6 - 90) * Math.PI / 180) * 12;
  ctx.lineTo(mX, mY);
  ctx.stroke();
  
  ctx.strokeStyle = "#ff6b4a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  const sX = clockX + Math.cos((seconds * 6 - 90) * Math.PI / 180) * 15;
  const sY = clockY + Math.sin((seconds * 6 - 90) * Math.PI / 180) * 15;
  ctx.lineTo(sX, sY);
  ctx.stroke();
}

export function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#050814";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - STATUS_BAR_HEIGHT);
  
  Object.values(ROOMS).forEach(room => {
    ctx.fillStyle = "#0a1023";
    ctx.fillRect(room.x, room.y, room.width, room.height);
  });
}

export function drawWalls(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#2a3548";
  ctx.lineWidth = 2;

  Object.values(ROOMS).forEach(room => {
    ctx.strokeRect(room.x, room.y, room.width, room.height);
    
    ctx.fillStyle = "#4a5a6a";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillText(room.label.toUpperCase(), room.x + 8, room.y + 12);
  });
}

export function drawZoneIndicators(ctx: CanvasRenderingContext2D, zoneActivity: Map<string, ZoneActivity>): void {
  Object.values(ROOMS).forEach(room => {
    const activity = zoneActivity.get(room.zoneId);
    if (!activity) return;
    
    if (activity.conversationActive) {
      const centerX = room.x + room.width / 2;
      const centerY = room.y + room.height / 2;
      
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 300);
      ctx.fillStyle = ZONE_CONFIG[room.zoneId]?.color || "#4a5a6a";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    if (activity.busyLevel === "busy") {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText("BUSY", room.x + room.width - 40, room.y + room.height - 8);
    } else if (activity.busyLevel === "quiet") {
      ctx.fillStyle = "#64b46e";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.fillText("QUIET", room.x + room.width - 45, room.y + room.height - 8);
    }
    
    if (activity.agentCount > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText(`${activity.agentCount}`, room.x + room.width - 15, room.y + 20);
    }
  });
}

export function drawMissionControl(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.missionControl;
  ctx.fillStyle = "#151a22";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Monitoring screens with graphs
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#1a2535";
    ctx.fillRect(room.x + 20 + i * 70, room.y + 35, 55, 60);
    ctx.fillStyle = "#0d1520";
    ctx.fillRect(room.x + 23 + i * 70, room.y + 38, 49, 54);
    
    // Mini graphs on screens
    ctx.strokeStyle = i === 0 ? "#00ff88" : i === 1 ? "#4a90d9" : "#ffcc00";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(room.x + 26 + i * 70, room.y + 85);
    ctx.lineTo(room.x + 35 + i * 70, room.y + 75);
    ctx.lineTo(room.x + 45 + i * 70, room.y + 80);
    ctx.lineTo(room.x + 55 + i * 70, room.y + 60);
    ctx.lineTo(room.x + 65 + i * 70, room.y + 65);
    ctx.stroke();
    
    // Screen border
    ctx.strokeStyle = "#2a3545";
    ctx.strokeRect(room.x + 20 + i * 70, room.y + 35, 55, 60);
  }
  
  // Control panel
  ctx.fillStyle = "#2a2a35";
  ctx.fillRect(room.x + 20, room.y + 110, room.width - 40, 50);
  ctx.fillStyle = "#3a3a45";
  ctx.fillRect(room.x + 22, room.y + 112, room.width - 44, 4);
  
  // Status lights with variety
  const lightColors = ["#00ff88", "#ffcc00", "#ff6b6b", "#4a90d9", "#ff9f43"];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = lightColors[i];
    ctx.beginPath();
    ctx.arc(room.x + 40 + i * 35, room.y + 135, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(room.x + 38 + i * 35, room.y + 133, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  
  // Small indicator buttons
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3a4a3a" : "#4a3a3a";
    ctx.fillRect(room.x + 165 + i * 12, room.y + 125, 8, 8);
  }
}

export function drawLobby(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.lobby;
  ctx.fillStyle = "#1a2230";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Reception Desk
  ctx.fillStyle = "#3d3225";
  ctx.fillRect(room.x + 20, room.y + 120, 100, 40);
  ctx.fillStyle = "#4a3d2e";
  ctx.fillRect(room.x + 20, room.y + 120, 100, 8);
}

export function drawArchives(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.archives;
  ctx.fillStyle = "#151a25";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Bookshelves with books
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#3a2a20";
    ctx.fillRect(room.x + 20 + i * 70, room.y + 40, 50, 120);
    ctx.fillStyle = "#4a3a30";
    ctx.fillRect(room.x + 20 + i * 70, room.y + 40, 50, 5);
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = COLORS.books[(i + j) % COLORS.books.length];
      ctx.fillRect(room.x + 25 + i * 70, room.y + 48 + j * 22, 40, 15);
    }
  }
  
  // Storage boxes on floor
  ctx.fillStyle = "#4a3a30";
  ctx.fillRect(room.x + 20, room.y + 165, 45, 25);
  ctx.fillStyle = "#5a4a40";
  ctx.fillRect(room.x + 22, room.y + 167, 41, 3);
  ctx.strokeStyle = "#3a2a20";
  ctx.lineWidth = 1;
  ctx.strokeRect(room.x + 20, room.y + 165, 45, 25);
  
  ctx.fillStyle = "#5a4a3a";
  ctx.fillRect(room.x + 70, room.y + 170, 40, 20);
  ctx.fillStyle = "#6a5a4a";
  ctx.fillRect(room.x + 72, room.y + 172, 36, 3);
  ctx.strokeStyle = "#4a3a2a";
  ctx.strokeRect(room.x + 70, room.y + 170, 40, 20);
  
  ctx.fillStyle = "#3a4a3a";
  ctx.fillRect(room.x + 115, room.y + 168, 35, 22);
  ctx.fillStyle = "#4a5a4a";
  ctx.fillRect(room.x + 117, room.y + 170, 31, 3);
  ctx.strokeStyle = "#2a3a2a";
  ctx.strokeRect(room.x + 115, room.y + 168, 35, 22);
}

export function drawSpecialistSuite(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.specialist;
  ctx.fillStyle = "#1a2230";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Dividers
  ctx.strokeStyle = "#2a3548";
  ctx.beginPath();
  ctx.moveTo(room.x + room.width / 3, room.y + 20);
  ctx.lineTo(room.x + room.width / 3, room.y + room.height - 5);
  ctx.moveTo(room.x + (room.width / 3) * 2, room.y + 20);
  ctx.lineTo(room.x + (room.width / 3) * 2, room.y + room.height - 5);
  ctx.stroke();
}

export function drawConferenceRoom(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.conference;
  const centerX = room.x + room.width / 2;
  const centerY = room.y + room.height / 2 + 10;

  ctx.fillStyle = "#1a2230";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Whiteboard on wall
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(room.x + room.width - 55, room.y + 35, 45, 60);
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x + room.width - 55, room.y + 35, 45, 60);
  ctx.strokeStyle = "#4a90d9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(room.x + room.width - 48, room.y + 50);
  ctx.lineTo(room.x + room.width - 20, room.y + 65);
  ctx.moveTo(room.x + room.width - 45, room.y + 70);
  ctx.lineTo(room.x + room.width - 25, room.y + 70);
  ctx.stroke();
  ctx.fillStyle = "#d44";
  ctx.fillRect(room.x + room.width - 42, room.y + 55, 3, 3);
  ctx.fillRect(room.x + room.width - 35, room.y + 58, 3, 3);
  ctx.fillRect(room.x + room.x - 28, room.y + 61, 3, 3);
  
  // Conference table
  ctx.fillStyle = "#2a3548";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 70, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3a4558";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Laptop on table
  ctx.fillStyle = "#4a4a5a";
  ctx.fillRect(centerX - 15, centerY - 10, 30, 18);
  ctx.fillStyle = "#3a3a4a";
  ctx.fillRect(centerX - 12, centerY - 8, 24, 14);
  ctx.fillStyle = "#1a3050";
  ctx.fillRect(centerX - 10, centerY - 6, 20, 10);
  ctx.fillStyle = "#00ff88";
  ctx.fillRect(centerX - 8, centerY - 4, 2, 2);
  ctx.fillRect(centerX - 4, centerY - 4, 2, 2);
  ctx.fillRect(centerX, centerY - 4, 2, 2);
  
  // Notepad on table
  ctx.fillStyle = "#f0f0e0";
  ctx.fillRect(centerX + 30, centerY - 15, 25, 30);
  ctx.strokeStyle = "#c0c0b0";
  ctx.lineWidth = 1;
  ctx.strokeRect(centerX + 30, centerY - 15, 25, 30);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = "#d0d0c0";
    ctx.beginPath();
    ctx.moveTo(centerX + 32, centerY - 10 + i * 6);
    ctx.lineTo(centerX + 53, centerY - 10 + i * 6);
    ctx.stroke();
  }
  
  // Water bottles on table
  ctx.fillStyle = "#6ab0d4";
  ctx.fillRect(centerX - 50, centerY - 5, 6, 15);
  ctx.fillStyle = "#4a90b4";
  ctx.fillRect(centerX - 50, centerY - 5, 6, 3);
  ctx.fillStyle = "#6ab0d4";
  ctx.fillRect(centerX + 45, centerY - 5, 6, 15);
  ctx.fillStyle = "#4a90b4";
  ctx.fillRect(centerX + 45, centerY - 5, 6, 3);
}

export function drawExecutiveSuite(ctx: CanvasRenderingContext2D, visibility?: AgentVisibility): void {
  const room = ROOMS.executive;

  ctx.fillStyle = "#1a2535";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Desk
  ctx.fillStyle = "#2a2530";
  ctx.fillRect(room.x + 40, room.y + 60, 100, 50);
  ctx.fillStyle = "#3a3540";
  ctx.fillRect(room.x + 40, room.y + 60, 100, 6);

  drawSherlockDoor(ctx, room, visibility);
}

// Alias for compatibility
export const drawBossOffice = drawExecutiveSuite;

function drawSherlockDoor(ctx: CanvasRenderingContext2D, room: any, visibility?: AgentVisibility): void {
  const doorX = room.x + room.width - 40;
  const doorY = room.y + room.height - 50;
  const doorWidth = 25;
  const doorHeight = 40;

  ctx.fillStyle = visibility === "offline" ? "#1a1a1a" : visibility === "private" ? "#2a1a2a" : "#3a2a1a";
  ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
  ctx.strokeStyle = visibility === "private" ? "#6b4a6b" : "#6b5a4a";
  ctx.strokeRect(doorX, doorY, doorWidth, doorHeight);
}

export function drawKitchen(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.kitchen;

  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Fridge
  ctx.fillStyle = "#c0c0c8";
  ctx.fillRect(room.x + 160, room.y + 40, 40, 100);
  ctx.strokeStyle = "#a0a0a8";
  ctx.lineWidth = 1;
  ctx.strokeRect(room.x + 160, room.y + 40, 40, 100);
  ctx.fillStyle = "#e0e0e8";
  ctx.fillRect(room.x + 165, room.y + 55, 30, 2);
  ctx.fillStyle = "#808088";
  ctx.fillRect(room.x + 195, room.y + 80, 3, 15);
  
  // Counter
  ctx.fillStyle = "#252a35";
  ctx.fillRect(room.x + 20, room.y + 160, 130, 30);
  ctx.fillStyle = "#353a45";
  ctx.fillRect(room.x + 20, room.y + 160, 130, 4);
  
  // Coffee machine
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(room.x + 30, room.y + 110, 50, 45);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(room.x + 35, room.y + 115, 40, 30);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(room.x + 40, room.y + 120, 30, 20);
  ctx.fillStyle = "#8b4513";
  ctx.fillRect(room.x + 48, room.y + 135, 14, 5);
  ctx.fillStyle = "#00ff88";
  ctx.beginPath();
  ctx.arc(room.x + 70, room.y + 120, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Coffee mugs on counter
  ctx.fillStyle = "#d4a574";
  ctx.fillRect(room.x + 90, room.y + 145, 10, 12);
  ctx.fillStyle = "#3d2410";
  ctx.fillRect(room.x + 92, room.y + 147, 6, 4);
  ctx.fillStyle = "#d4a574";
  ctx.fillRect(room.x + 105, room.y + 145, 10, 12);
  
  // Water cooler
  ctx.fillStyle = "#4a6b8a";
  ctx.fillRect(room.x + 100, room.y + 60, 25, 50);
  ctx.fillStyle = "#5a8bba";
  ctx.fillRect(room.x + 102, room.y + 62, 21, 20);
  ctx.fillStyle = "#3a5b7a";
  ctx.fillRect(room.x + 102, room.y + 85, 21, 25);
  ctx.fillStyle = "#6a9bca";
  ctx.beginPath();
  ctx.arc(room.x + 112, room.y + 75, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8abcdc";
  ctx.beginPath();
  ctx.arc(room.x + 112, room.y + 75, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#708090";
  ctx.fillRect(room.x + 108, room.y + 40, 8, 20);
  ctx.fillStyle = "#5a7a8a";
  ctx.beginPath();
  ctx.arc(room.x + 112, room.y + 38, 6, Math.PI, 0);
  ctx.fill();
  
  // Snack shelf / cabinet
  ctx.fillStyle = "#3a2a20";
  ctx.fillRect(room.x + 160, room.y + 155, 40, 35);
  ctx.fillStyle = "#4a3a30";
  ctx.fillRect(room.x + 163, room.y + 158, 34, 3);
  ctx.fillStyle = "#4a3a30";
  ctx.fillRect(room.x + 163, room.y + 175, 34, 3);
  ctx.fillStyle = "#8b4513";
  ctx.fillRect(room.x + 165, room.y + 161, 8, 12);
  ctx.fillStyle = "#4a8b5a";
  ctx.fillRect(room.x + 176, room.y + 163, 6, 10);
  ctx.fillStyle = "#8b6b4a";
  ctx.fillRect(room.x + 186, room.y + 162, 8, 11);
}

export function drawCubicles(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.openOffice;
  ctx.fillStyle = "#0d1220";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);

  // Draw only the cubicles that belong to the open office (indices 1 and 2)
  [1, 2].forEach(index => {
    const pos = CUBICLE_POSITIONS[index];
    ctx.fillStyle = "#1a1f28";
    ctx.fillRect(pos.x, pos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
    ctx.strokeStyle = "#2a3040";
    ctx.strokeRect(pos.x, pos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
    
    // Monitor on desk
    ctx.fillStyle = "#2a2a35";
    ctx.fillRect(pos.x + 60, pos.y + 25, 45, 30);
    ctx.fillStyle = "#1a2535";
    ctx.fillRect(pos.x + 63, pos.y + 28, 39, 24);
    ctx.fillStyle = "#3a3a45";
    ctx.fillRect(pos.x + 80, pos.y + 55, 15, 5);
    
    // Small plant
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(pos.x + 15, pos.y + 50, 12, 15);
    ctx.fillStyle = "#1a4a2a";
    ctx.fillRect(pos.x + 12, pos.y + 40, 18, 12);
    ctx.fillStyle = "#2a5a3a";
    ctx.fillRect(pos.x + 16, pos.y + 35, 10, 8);
  });
  
  // Also draw Lobby desk (index 0) since drawCubicles used to handle all CUBICLE_POSITIONS
  const lobbyPos = CUBICLE_POSITIONS[0];
  ctx.fillStyle = "#3d3225";
  ctx.fillRect(lobbyPos.x, lobbyPos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
  ctx.strokeStyle = "#4a3d2e";
  ctx.strokeRect(lobbyPos.x, lobbyPos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
  // Bell on reception desk
  ctx.fillStyle = "#d4a574";
  ctx.beginPath();
  ctx.arc(lobbyPos.x + 60, lobbyPos.y + 35, 8, 0, Math.PI * 2);
  ctx.fill();

  // Specialist desks (indices 5, 6, 7)
  [5, 6, 7].forEach(index => {
    const pos = CUBICLE_POSITIONS[index];
    ctx.fillStyle = "#1a1f28";
    ctx.fillRect(pos.x, pos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
    ctx.strokeStyle = "#2a3040";
    ctx.strokeRect(pos.x, pos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
    
    // Monitor on specialist desk
    ctx.fillStyle = "#2a2a35";
    ctx.fillRect(pos.x + 60, pos.y + 25, 45, 30);
    ctx.fillStyle = "#1a2535";
    ctx.fillRect(pos.x + 63, pos.y + 28, 39, 24);
    ctx.fillStyle = "#3a3a45";
    ctx.fillRect(pos.x + 80, pos.y + 55, 15, 5);
    
    // Paper stacks
    ctx.fillStyle = "#e8e8e0";
    ctx.fillRect(pos.x + 20, pos.y + 35, 25, 3);
    ctx.fillRect(pos.x + 22, pos.y + 40, 20, 2);
  });

  // Archive desk (index 3)
  const archivePos = CUBICLE_POSITIONS[3];
  ctx.fillStyle = "#1a1f28";
  ctx.fillRect(archivePos.x, archivePos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
  ctx.strokeStyle = "#2a3040";
  ctx.strokeRect(archivePos.x, archivePos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
  // Archive box
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(archivePos.x + 70, archivePos.y + 40, 35, 25);

  // Executive desk (index 4)
  const execPos = CUBICLE_POSITIONS[4];
  ctx.fillStyle = "#2a2530";
  ctx.fillRect(execPos.x, execPos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
  ctx.strokeStyle = "#3a3540";
  ctx.strokeRect(execPos.x, execPos.y, CUBICLE_WIDTH, CUBICLE_HEIGHT);
  // Executive monitor
  ctx.fillStyle = "#2a2a35";
  ctx.fillRect(execPos.x + 55, execPos.y + 20, 50, 35);
  ctx.fillStyle = "#1a2535";
  ctx.fillRect(execPos.x + 58, execPos.y + 23, 44, 29);
  ctx.fillStyle = "#4a90d9";
  ctx.fillRect(execPos.x + 62, execPos.y + 27, 8, 4);
  ctx.fillStyle = "#3a3a45";
  ctx.fillRect(execPos.x + 75, execPos.y + 55, 20, 5);
}

export function drawGym(ctx: CanvasRenderingContext2D): void {
  const room = ROOMS.gym;
  ctx.fillStyle = "#151a22";
  ctx.fillRect(room.x + 5, room.y + 20, room.width - 10, room.height - 25);
  
  // Exercise mat
  ctx.fillStyle = "#2a4a6a";
  ctx.fillRect(room.x + 80, room.y + 45, 80, 40);
  ctx.strokeStyle = "#3a5a7a";
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x + 80, room.y + 45, 80, 40);
  
  // Dumbbells
  ctx.fillStyle = "#5a5a5a";
  ctx.fillRect(room.x + 20, room.y + 30, 25, 8);
  ctx.fillRect(room.x + 17, room.y + 25, 8, 18);
  ctx.fillRect(room.x + 40, room.y + 25, 8, 18);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(room.x + 25, room.y + 31, 15, 6);
  
  ctx.fillStyle = "#5a5a5a";
  ctx.fillRect(room.x + 55, room.y + 35, 20, 6);
  ctx.fillRect(room.x + 52, room.y + 30, 6, 16);
  ctx.fillRect(room.x + 72, room.y + 30, 6, 16);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(room.x + 58, room.y + 36, 14, 4);
  
  // Barbell
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(room.x + 15, room.y + 55, 70, 6);
  ctx.fillRect(room.x + 12, room.y + 48, 12, 20);
  ctx.fillRect(room.x + 76, room.y + 48, 12, 20);
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(room.x + 14, room.y + 50, 8, 16);
  ctx.fillRect(room.x + 78, room.y + 50, 8, 16);
  
  // Towel rack
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(room.x + 140, room.y + 30, 30, 4);
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(room.x + 145, room.y + 34, 20, 15);
  ctx.fillRect(room.x + 145, room.y + 50, 20, 8);
}

// Alias for compatibility
export const drawLounge = drawGym;

export function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(x + 8, y + 20, 8, 10);

  ctx.fillStyle = "#1a4a2a";
  ctx.fillRect(x, y + 10, 24, 12);
  ctx.fillStyle = "#2a5a3a";
  ctx.fillRect(x + 4, y, 16, 10);
}

export function drawStatusBar(ctx: CanvasRenderingContext2D, agents: any[], shouldRespectPrivacy: boolean = true): void {
  const barY = CANVAS_HEIGHT - STATUS_BAR_HEIGHT;
  
  ctx.fillStyle = COLORS.statusBarBg;
  ctx.fillRect(0, barY, CANVAS_WIDTH, STATUS_BAR_HEIGHT);
  
  ctx.strokeStyle = COLORS.wallBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();

  const agentWidth = 150;
  const startX = (CANVAS_WIDTH - agents.length * agentWidth) / 2;

  agents.forEach((agent, index) => {
    const x = startX + index * agentWidth + 5;
    const y = barY + 10;

    const isOffline = shouldRespectPrivacy && agent.visibility === "offline";
    const isPrivate = shouldRespectPrivacy && agent.visibility === "private";

    if (isOffline) {
      ctx.fillStyle = "#444444";
    } else {
      ctx.fillStyle = agent.color;
    }
    ctx.beginPath();
    ctx.arc(x + 12, y + 20, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.font = "600 12px 'JetBrains Mono', monospace";
    ctx.fillText(agent.name, x + 25, y + 20);

    let statusText = "";
    let statusColor = "#888888";
    
    if (isOffline) {
      statusText = "Offline";
      statusColor = "#666666";
    } else if (isPrivate) {
      statusText = "Busy";
      statusColor = "#aa88ff";
    } else {
      statusText = agent.status === "working" ? "Working" : "Idle";
      statusColor = agent.status === "working" ? COLORS.statusWorking : COLORS.statusIdle;
    }
    
    ctx.fillStyle = statusColor;
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillText(statusText, x + 25, y + 35);
  });
}
