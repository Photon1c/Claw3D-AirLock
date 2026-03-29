import { Agent } from "../types";
import { COLORS, CHAIR_POSITIONS, ROLE_DESK_ITEMS } from "./layout";
import { getMoodEmoji } from "./agentLogic";

// Character images
let sherlobsterImg: HTMLImageElement | null = null;
let sherlobsterLoaded = false;

// Load Sherlobster character image
function loadSherlobsterImage() {
  if (sherlobsterImg) return;
  sherlobsterImg = new Image();
  sherlobsterImg.onload = () => {
    sherlobsterLoaded = true;
    console.log("Sherlobster character loaded");
  };
  sherlobsterImg.onerror = () => {
    console.warn("Failed to load Sherlobster character image");
  };
  sherlobsterImg.src = "/img/character/sherlobster_transparent.png";
}

// Initialize on first draw
let initialized = false;

export function drawAgent(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  showNames: boolean
): void {
  // Load character image once
  if (!initialized) {
    initialized = true;
    loadSherlobsterImage();
  }

  const { x, y, dir, frame, mode, color, mood, thoughtBubble, status, role } = agent;
  const facingLeft = dir === "left";
  const scale = 1.5;

  // Check if this is the Sherlobster agent
  const isSherlobster = agent.id === "sherlobster";

  // Draw Sherlobster with character image
  if (isSherlobster && sherlobsterLoaded && sherlobsterImg) {
    drawSherlobster(ctx, agent, showNames);
    return;
  }

  // Determine color based on status and role
  let agentColor = color;
  if (status === "working") {
    // Use role-based color when working
    const roleColors: Record<string, string> = {
      receptionist: "#b4b4c4",
      clerk: "#3498db",
      custodian: "#4ecdc4",
      archivist: "#9b59b6",
      executive: "#e74c3c",
      specialist: "#ff6b6b",
    };
    agentColor = roleColors[role] || color;
  } else {
    // Use status-based color when not working
    agentColor = COLORS.statusIdle;
  }

  ctx.save();
  ctx.translate(x, y);
  if (facingLeft) {
    ctx.scale(-1, 1);
  }
  ctx.scale(scale, scale);

  // Add subtle idle bobbing when in kitchen or conference room (conversation zones)
  const inKitchen = x >= 960 && x <= 1190 && y >= 10 && y <= 240;
  const inConference = x >= 710 && x <= 940 && y >= 10 && y <= 210;
  const inConversationZone = inKitchen || inConference;
  
  let idleBobOffset = 0;
  if (mode !== "walking" && mode !== "sitting" && inConversationZone) {
    // Subtle vertical bobbing for idle agents in conversation zones
    idleBobOffset = Math.sin(Date.now() / 500) * 1.5;
  }
  ctx.translate(0, idleBobOffset);

  const skinColor = "#e8b89d";
  const hairColor = "#3a2820";
  const pantsColor = "#2a3040";
  const shoeColor = "#1a1a1a";

  if (mode === "sitting") {
    ctx.fillStyle = pantsColor;
    ctx.fillRect(-6, 4, 12, 8);

    ctx.fillStyle = agentColor;
    ctx.fillRect(-8, -10, 16, 14);

    ctx.fillStyle = skinColor;
    ctx.fillRect(-6, -18, 12, 10);

    ctx.fillStyle = hairColor;
    ctx.fillRect(-6, -22, 12, 5);
    ctx.fillRect(-4, -24, 8, 3);

    ctx.fillStyle = skinColor;
    ctx.fillRect(2, -6, 8, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(6, -5, 4, 2);
  } else {
    // Enhanced leg animation with more realistic movement
    const legPhase = frame === 0 ? 0 : 1;
    const legOffset = legPhase === 0 ? 1.5 : -1.5;
    const legSwing = legPhase === 0 ? 2 : -2;
    
    // Enhanced arm animation with more realistic movement
    const armPhase = frame === 0 ? 0 : 1;
    const armOffset = armPhase === 0 ? -1.5 : 1.5;
    const armSwing = armPhase === 0 ? -2 : 2;

    // Left leg
    ctx.fillStyle = pantsColor;
    ctx.fillRect(-4 + legOffset - legSwing, 4, 4, 10);
    
    // Right leg
    ctx.fillStyle = pantsColor;
    ctx.fillRect(0 - legOffset + legSwing, 4, 4, 10);

    // Shoes
    ctx.fillStyle = shoeColor;
    ctx.fillRect(-5 + legOffset - legSwing, 12, 6, 3);
    ctx.fillRect(1 - legOffset + legSwing, 12, 6, 3);

    // Body
    ctx.fillStyle = agentColor;
    ctx.fillRect(-8, -8, 16, 14);

    // Head
    ctx.fillStyle = skinColor;
    ctx.fillRect(-4, -16, 10, 10);

    // Hair
    ctx.fillStyle = hairColor;
    ctx.fillRect(-5, -20, 10, 5);
    ctx.fillRect(-3, -22, 6, 3);

    // Arms with enhanced animation
    // Left arm
    ctx.fillStyle = skinColor;
    ctx.fillRect(-12 + armOffset - armSwing, -4, 4, 10);
    
    // Right arm
    ctx.fillStyle = skinColor;
    ctx.fillRect(8 - armOffset + armSwing, -4, 4, 10);
    
    // Hands (more detailed)
    ctx.fillStyle = skinColor;
    ctx.fillRect(-14 + armOffset - armSwing, -4, 2, 4);
    ctx.fillRect(10 - armOffset + armSwing, -4, 2, 4);
  }

  ctx.restore();

  if (showNames) {
    ctx.fillStyle = COLORS.white;
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(agent.name, x, y - 35);
    
    ctx.font = "400 12px sans-serif";
    ctx.fillText(getMoodEmoji(mood), x, y - 45);
    ctx.textAlign = "start";
    
    if (status === "working") {
      ctx.fillStyle = COLORS.statusWorking;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x + 20, y - 35, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.statusWorking;
      ctx.beginPath();
      ctx.arc(x + 20, y - 35, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (thoughtBubble) {
    drawThoughtBubble(ctx, x, y - 60, thoughtBubble.text);
  }
}

function drawThoughtBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  const textWidth = ctx.measureText(text).width;
  const padding = 8;
  const maxWidth = Math.min(textWidth + padding * 2, 180);
  const lineHeight = 16;
  const lines = wrapText(ctx, text, maxWidth - padding * 2);
  const bubbleHeight = Math.max(lines.length * lineHeight + padding * 2, 28);
  const bubbleWidth = Math.min(maxWidth, textWidth + padding * 2);
  
  const bubbleX = x - bubbleWidth / 2;
  const bubbleY = y - bubbleHeight / 2;
  
  ctx.save();
  
  ctx.fillStyle = "rgba(20, 25, 35, 0.95)";
  ctx.strokeStyle = "#4a90d9";
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 6);
  ctx.fill();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x - 6, bubbleY + bubbleHeight);
  ctx.lineTo(x - 10, bubbleY + bubbleHeight + 10);
  ctx.lineTo(x + 6, bubbleY + bubbleHeight);
  ctx.closePath();
  ctx.fillStyle = "rgba(20, 25, 35, 0.95)";
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = "#e8e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textY = bubbleY + bubbleHeight / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, textY + (i - (lines.length - 1) / 2) * lineHeight);
  });
  
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

function drawSherlobster(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  showNames: boolean
): void {
  const { x, y, dir, frame, mode, mood, thoughtBubble, status } = agent;
  const facingLeft = dir === "left";

  ctx.save();
  ctx.translate(x, y);
  
  if (facingLeft) {
    ctx.scale(-1, 1);
  }

  // Draw Sherlobster image
  if (sherlobsterImg) {
    // Character is standing or sitting
    const isSitting = mode === "sitting";
    const height = isSitting ? 50 : 60;
    const width = 34;
    
    // Add slight bobbing when walking
    let bobOffset = 0;
    if (mode === "walking") {
      bobOffset = Math.sin(frame * Math.PI) * 2;
    }

    ctx.globalAlpha = 0.9;
    ctx.drawImage(
      sherlobsterImg,
      -width / 2,
      -height + bobOffset,
      width,
      height
    );
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Draw name
  if (showNames) {
    ctx.fillStyle = COLORS.white;
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(agent.name, x, y - 55);
    
    // Draw mood emoji
    ctx.font = "400 12px sans-serif";
    ctx.fillText(getMoodEmoji(mood), x, y - 65);
    ctx.textAlign = "start";
    
    // Draw working indicator
    if (status === "working") {
      ctx.fillStyle = COLORS.statusWorking;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x + 20, y - 55, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.statusWorking;
      ctx.beginPath();
      ctx.arc(x + 20, y - 55, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw thought bubble
  if (thoughtBubble) {
    drawThoughtBubble(ctx, x, y - 80, thoughtBubble.text);
  }
}

function drawGlobe(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#4a8bba";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a6a9a";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 7, Math.PI * 0.8, Math.PI * 1.2);
  ctx.fill();
  ctx.fillStyle = "#5a9bca";
  ctx.fillRect(x + 8, y + 1, 1, 14);
  ctx.fillStyle = "#2a5a7a";
  ctx.fillRect(x + 3, y + 8, 10, 1);
}

function drawBooks(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const bookColors = ["#8b4a6b", "#4a6b8a", "#6b5a4a"];
  bookColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + 2 + i * 5, y + 2, 4, 12);
  });
}

function drawCoffee(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#d0d0d0";
  ctx.fillRect(x + 4, y + 4, 8, 10);
  ctx.fillStyle = "#8b4a3a";
  ctx.fillRect(x + 5, y + 5, 6, 3);
  ctx.fillStyle = "#a0a0a0";
  ctx.fillRect(x + 12, y + 6, 3, 6);
}

function drawPalette(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#8b6b4a";
  ctx.fillRect(x + 2, y + 8, 14, 6);
  const colors = ["#ff4b4b", "#4bff4b", "#4b4bff", "#ffff4b"];
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 4 + i * 3, y + 11, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#6a8aba";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 2);
  ctx.lineTo(x + 14, y + 4);
  ctx.lineTo(x + 14, y + 10);
  ctx.lineTo(x + 8, y + 14);
  ctx.lineTo(x + 2, y + 10);
  ctx.lineTo(x + 2, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a9aca";
  ctx.fillRect(x + 7, y + 5, 2, 8);
}

function drawFire(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#ff4b4b";
  ctx.fillRect(x + 5, y + 6, 6, 8);
  ctx.fillStyle = "#ff8b4b";
  ctx.fillRect(x + 6, y + 8, 4, 6);
  ctx.fillStyle = "#ffcb4b";
  ctx.fillRect(x + 7, y + 10, 2, 4);
}

function drawCamera(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 2, y + 4, 12, 8);
  ctx.fillStyle = "#5a5a7a";
  ctx.fillRect(x + 4, y + 6, 8, 5);
  ctx.fillStyle = "#2a2a3a";
  ctx.fillRect(x + 6, y + 7, 4, 3);
}

function drawWaveform(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#4a8bba";
  ctx.fillRect(x + 2, y + 8, 2, 4);
  ctx.fillRect(x + 5, y + 6, 2, 8);
  ctx.fillRect(x + 8, y + 4, 2, 12);
  ctx.fillRect(x + 11, y + 7, 2, 6);
  ctx.fillRect(x + 14, y + 9, 2, 2);
}

function drawWrench(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#8b4a6b";
  ctx.fillRect(x + 5, y + 5, 6, 2);
  ctx.fillRect(x + 3, y + 3, 2, 6);
  ctx.fillRect(x + 9, y + 3, 2, 6);
  ctx.beginPath();
  ctx.arc(x + 5, y + 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6a354b";
  ctx.fillRect(x + 4, y + 4, 4, 4);
}

function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#6a8aba";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a6b8a";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6a8aba";
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(
      x + 8 + Math.cos(angle) * 3,
      y + 8 + Math.sin(angle) * 3
    );
    ctx.lineTo(
      x + 8 + Math.cos(angle) * 6,
      y + 8 + Math.sin(angle) * 6
    );
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#4a6b8a";
}

function drawBook(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#8b4a6b";
  ctx.fillRect(x + 4, y + 4, 8, 10);
  ctx.fillStyle = "#6a354b";
  ctx.fillRect(x + 5, y + 5, 6, 2);
  ctx.fillRect(x + 5, y + 8, 6, 2);
}

function drawCompass(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#4a6b8a";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a3548";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a6b8a";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 2);
  ctx.lineTo(x + 8, y + 14);
  ctx.moveTo(x + 2, y + 8);
  ctx.lineTo(x + 14, y + 8);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a3548";
}

function drawRadio(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#6a354b";
  ctx.fillRect(x + 4, y + 4, 8, 10);
  ctx.fillStyle = "#8b4a6b";
  ctx.fillRect(x + 5, y + 5, 6, 2);
  ctx.fillRect(x + 5, y + 8, 6, 2);
  ctx.fillStyle = "#4a6b8a";
  ctx.beginPath();
  ctx.arc(x + 7, y + 7, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#2a3548";
  ctx.fillRect(x + 4, y + 4, 8, 10);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(x + 5, y + 5, 6, 2);
  ctx.fillStyle = "#2a3548";
  ctx.fillRect(x + 6, y + 7, 4, 2);
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(x + 8, y + 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDeskItem(ctx: CanvasRenderingContext2D, agent: Agent): void {
  const deskIndex = agent.deskIndex;
  if (deskIndex < 0 || deskIndex >= CHAIR_POSITIONS.length) return;

  const pos = CHAIR_POSITIONS[deskIndex];
  const role = agent.role.toLowerCase();
  const itemType = ROLE_DESK_ITEMS[role] || "globe";

  const x = pos.x + 40;
  const y = pos.y - 30;

  switch (itemType) {
    case "globe":
      drawGlobe(ctx, x, y);
      break;
    case "books":
      drawBooks(ctx, x, y);
      break;
    case "coffee":
      drawCoffee(ctx, x, y);
      break;
    case "palette":
      drawPalette(ctx, x, y);
      break;
    case "shield":
      drawShield(ctx, x, y);
      break;
    case "fire":
      drawFire(ctx, x, y);
      break;
    case "camera":
      drawCamera(ctx, x, y);
      break;
    case "waveform":
      drawWaveform(ctx, x, y);
      break;
    case "wrench":
      drawWrench(ctx, x, y);
      break;
    case "gear":
      drawGear(ctx, x, y);
      break;
    case "book":
      drawBook(ctx, x, y);
      break;
    case "compass":
      drawCompass(ctx, x, y);
      break;
    case "radio":
      drawRadio(ctx, x, y);
      break;
    case "lock":
      drawLock(ctx, x, y);
      break;
    default:
      drawGlobe(ctx, x, y);
  }
}
