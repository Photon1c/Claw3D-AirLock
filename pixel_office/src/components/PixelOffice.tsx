import { useEffect, useRef, useState, useCallback } from "react";
import { Agent, DashboardConfig, AgentStatus, AgentVisibility, Task, TaskStatus, TaskPriority, ZoneActivity } from "../types";
import GenealogyLab from "./GenealogyLab";
import AdminAssistant from "./AdminAssistant";
import StockForecasts from "./StockForecasts";
import TimeTasksPanel from "./TimeTasksPanel";
import ScrumPanel from "./ScrumPanel";
import {
  INITIAL_AGENTS,
  updateAgentPosition,
  updateAgentStatus,
  handleWanderLogic,
  updateAgentMood,
  generateThoughtBubble,
  clearExpiredThoughts,
  MOOD_OPTIONS,
  getMoodEmoji,
} from "../utils/agentLogic";
import { loadAgentCards, AgentCard } from "../utils/agentCards";
import {
  drawFloor,
  drawWalls,
  drawConferenceRoom,
  drawBossOffice,
  drawKitchen,
  drawCubicles,
  drawLounge,
  drawPlants,
  drawStatusBar,
  drawLobby,
  drawArchives,
  drawSpecialistSuite,
  drawZoneIndicators,
  drawMissionControl,
} from "../utils/drawOffice";
import { drawAgent, drawDeskItem } from "../utils/drawAgent";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  CHAIR_POSITIONS,
  getZoneAtPosition,
} from "../utils/layout";

const DEFAULT_CONFIG: DashboardConfig = {
  pollingInterval: 5000,
  mockMode: true,
  mockToggleSpeed: 5000,
  showStatusBar: true,
  showNames: true,
  animationSpeed: 2,
  theme: "dark",
  canvasScale: 1,
  liveMode: false,
  viewMode: "public",
};

interface PixelOfficeProps {
  config?: Partial<DashboardConfig>;
}

type ThreeDSessionCreateResponse = {
  ok?: boolean;
  sessionId?: string;
  claw3d?: {
    launchUrl?: string;
  };
  error?: string;
};

export default function PixelOffice({ config = {} }: PixelOfficeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({
    ...DEFAULT_CONFIG,
    ...config,
  });
  const [showParams, setShowParams] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showTaskManager, setShowTaskManager] = useState<boolean>(false);
  const [showGenealogyLab, setShowGenealogyLab] = useState<boolean>(false);
  const [showAdminAssistant, setShowAdminAssistant] = useState<boolean>(false);
  const [showStockForecasts, setShowStockForecasts] = useState<boolean>(false);
  const [showTimeTasks, setShowTimeTasks] = useState<boolean>(false);
  const [showScrum, setShowScrum] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [go3dBusy, setGo3dBusy] = useState<boolean>(false);
  const [go3dSessionId, setGo3dSessionId] = useState<string | null>(null);
  const [go3dLaunchUrl, setGo3dLaunchUrl] = useState<string | null>(null);
  const [go3dStatus, setGo3dStatus] = useState<string | null>(null);
  const [zoneActivity, setZoneActivity] = useState<Map<string, ZoneActivity>>(new Map());
  const [, setActiveConversationZone] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "Review pull requests", description: "Check pending PRs from team", status: "in_progress", priority: "high", assigneeId: "ironclaw", createdAt: Date.now() - 86400000 },
    { id: "2", title: "Update documentation", description: "Add new API endpoints to docs", status: "todo", priority: "medium", createdAt: Date.now() - 172800000 },
    { id: "3", title: "Fix login bug", description: "Users reporting intermittent login failures", status: "done", priority: "high", assigneeId: "zeroclaw", createdAt: Date.now() - 259200000 },
    { id: "4", title: "Deploy to staging", description: "Push latest changes to staging environment", status: "todo", priority: "low", createdAt: Date.now() - 345600000 },
  ]);
  
  // Workflow animation state (using ref to avoid TypeScript issues)
  const workflowStateRef = useRef<{
    taskId: string;
    currentStep: number;
    totalSteps: number;
    currentAgent: string;
    status: "running" | "completed" | "failed";
    message: string;
  } | null>(null);
  const [, forceUpdate] = useState(0);
  
  const setWorkflowState = (state: typeof workflowStateRef.current) => {
    workflowStateRef.current = state;
    forceUpdate(n => n + 1);
  };
  const workflowState = workflowStateRef.current;

  const lastFrameTime = useRef<number>(0);
  const walkCycleTimer = useRef<number>(0);
  const coolerTalkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coolerTalkEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!dashboardConfig.liveMode) return;

    try {
      const response = await fetch("/api/employee-status");
      const data = await response.json();
      setAgents((prevAgents) =>
        prevAgents.map((agent) => {
          const statusUpdate = data.employees.find(
            (e: { id: string; status: AgentStatus; visibility?: AgentVisibility }) => e.id === agent.id
          );
          if (statusUpdate) {
            const updatedAgent = updateAgentStatus(agent, statusUpdate.status);
            return {
              ...updatedAgent,
              visibility: statusUpdate.visibility || "public",
            };
          }
          return agent;
        })
      );
    } catch (error) {
      console.error("Failed to fetch employee status:", error);
    }
  }, [dashboardConfig.liveMode]);

   useEffect(() => {
     if (dashboardConfig.liveMode) {
       const interval = setInterval(fetchStatus, dashboardConfig.pollingInterval);
       return () => clearInterval(interval);
     }
 
     if (dashboardConfig.mockMode) {
       const interval = setInterval(
         () => {
           setAgents((prevAgents) =>
             prevAgents.map((agent) => {
               const newStatus: AgentStatus =
                 Math.random() > 0.3 ? "working" : "idle";
               return updateAgentStatus(agent, newStatus);
             })
           );
         },
         dashboardConfig.mockToggleSpeed
       );
       return () => clearInterval(interval);
     }
 
     // WASD controls for LeslieClaw agent
     const handleKeyDown = (e: KeyboardEvent) => {
       // Only process if LeslieClaw exists in our agents
       const leslieClaw = agents.find(agent => agent.id === "leslieclaw");
       if (leslieClaw) {
         const moveAmount = 5; // Movement speed in pixels
         
         switch(e.key.toLowerCase()) {
           case 'w': // Move up
             e.preventDefault();
             setAgents(prevAgents =>
               prevAgents.map(agent =>
                 agent.id === "leslieclaw"
                   ? { ...agent, y: agent.y - moveAmount }
                   : agent
               )
             );
             break;
             
           case 's': // Move down
             e.preventDefault();
             setAgents(prevAgents =>
               prevAgents.map(agent =>
                 agent.id === "leslieclaw"
                   ? { ...agent, y: agent.y + moveAmount }
                   : agent
               )
             );
             break;
             
           case 'a': // Move left
             e.preventDefault();
             setAgents(prevAgents =>
               prevAgents.map(agent =>
                 agent.id === "leslieclaw"
                   ? { ...agent, x: agent.x - moveAmount }
                   : agent
               )
             );
             break;
             
           case 'd': // Move right
             e.preventDefault();
             setAgents(prevAgents =>
               prevAgents.map(agent =>
                 agent.id === "leslieclaw"
                   ? { ...agent, x: agent.x + moveAmount }
                   : agent
               )
             );
             break;
         }
       }
     };
 
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [agents]);

  useEffect(() => {
    const moodInterval = setInterval(() => {
      setAgents((prevAgents) =>
        prevAgents.map((agent) => {
          const randomMood = MOOD_OPTIONS[Math.floor(Math.random() * MOOD_OPTIONS.length)];
          let updated = updateAgentMood(agent, randomMood);
          
          if (Math.random() > 0.5) {
            updated = generateThoughtBubble(updated);
          }
          
          return clearExpiredThoughts(updated);
        })
      );
    }, 4000);
    
    return () => clearInterval(moodInterval);
  }, []);

  useEffect(() => {
    const zoneInterval = setInterval(() => {
      setAgents(prevAgents => {
        const newActivity = new Map<string, ZoneActivity>();
        
        prevAgents.forEach(agent => {
          const zone = getZoneAtPosition(agent.x, agent.y);
          if (!zone) return;
          
          const existing = newActivity.get(zone) || {
            zoneId: zone,
            agentCount: 0,
            busyLevel: "quiet" as const,
            lastActivity: Date.now(),
            conversationActive: false,
          };
          
          existing.agentCount += 1;
          if (agent.status === "working") {
            existing.busyLevel = existing.agentCount > 2 ? "busy" : "moderate";
          }
          existing.lastActivity = Date.now();
          
          newActivity.set(zone, existing);
        });
        
        setZoneActivity(newActivity);
        return prevAgents;
      });
    }, 2000);
    
    return () => clearInterval(zoneInterval);
  }, []);

  useEffect(() => {
    setAgents((prevAgents) =>
      prevAgents.map(clearExpiredThoughts)
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = (timestamp: number) => {
      const deltaTime = timestamp - lastFrameTime.current;
      lastFrameTime.current = timestamp;

      walkCycleTimer.current += deltaTime;

      setAgents((prevAgents) =>
        prevAgents.map((agent) => {
          let updatedAgent = updateAgentPosition(
            agent,
            dashboardConfig.animationSpeed,
            deltaTime
          );
          updatedAgent = handleWanderLogic(updatedAgent);

          if (
            walkCycleTimer.current > 150 &&
            updatedAgent.mode === "walking"
          ) {
            updatedAgent = {
              ...updatedAgent,
              frame: updatedAgent.frame === 0 ? 1 : 0,
            };
            walkCycleTimer.current = 0;
          }

          return updatedAgent;
        })
      );

      ctx.save();
      
      const scaleX = canvas.width / CANVAS_WIDTH;
      const scaleY = canvas.height / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      ctx.scale(scale, scale);

      drawFloor(ctx);
      drawWalls(ctx);
      drawLobby(ctx);
      drawArchives(ctx);
      drawSpecialistSuite(ctx);
      drawConferenceRoom(ctx);
      
       const leslieclaw = agents.find(a => a.id === "leslieclaw");
       drawBossOffice(ctx, leslieclaw?.visibility);
     
      drawKitchen(ctx);
      drawMissionControl(ctx);
      drawCubicles(ctx);
      drawLounge(ctx);
      drawPlants(ctx);

      agents.forEach((agent) => {
        drawDeskItem(ctx, agent);
      });

      const shouldRespectPrivacy = dashboardConfig.viewMode === "public";

      agents.forEach((agent) => {
        if (shouldRespectPrivacy && agent.visibility === "offline") return;
        drawAgent(ctx, agent, dashboardConfig.showNames);
      });

      drawZoneIndicators(ctx, zoneActivity);

      if (dashboardConfig.showStatusBar) {
        drawStatusBar(ctx, agents, shouldRespectPrivacy);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrameId);
  }, [agents, dashboardConfig]);

  const updateConfig = (updates: Partial<DashboardConfig>) => {
    setDashboardConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    const worldClickX = clickX / scale;
    const worldClickY = clickY / scale;

    const clickedAgent = agents.find(agent => {
      const dx = agent.x - worldClickX;
      const dy = agent.y - worldClickY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 40;
    });

    if (clickedAgent) {
      setSelectedAgent(clickedAgent);
    } else {
      setSelectedAgent(null);
    }
  }, [agents]);

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const addTask = (title: string, description: string, priority: TaskPriority) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      description,
      status: "todo",
      priority,
      createdAt: Date.now(),
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleGo3D = useCallback(async () => {
    setGo3dBusy(true);
    setGo3dStatus("Creating Pixel Office 3D session...");
    try {
      const activeTask = tasks.find((task) => task.status === "in_progress");
      const maybeTaskId = activeTask?.id ? Number.parseInt(activeTask.id, 10) : Number.NaN;
      const taskId = Number.isFinite(maybeTaskId) ? maybeTaskId : undefined;
      const response = await fetch("/api/3d/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "pixeloffice-ui",
          actorId: selectedAgent?.id ?? null,
          taskId,
          ui: {
            selectedAgentId: selectedAgent?.id ?? null,
            showScrum,
            showChat,
            showTimeTasks,
          },
        }),
      });
      const payload = (await response.json()) as ThreeDSessionCreateResponse;
      if (!response.ok || !payload.sessionId) {
        throw new Error(payload.error || "Failed to create 3D session.");
      }
      setGo3dSessionId(payload.sessionId);
      const launchUrl = payload.claw3d?.launchUrl?.trim() || null;
      setGo3dLaunchUrl(launchUrl);
      setGo3dStatus(`3D session ready: ${payload.sessionId}`);
      await fetch("/api/3d/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          eventType: "ui.go3d.clicked",
          actorId: selectedAgent?.id ?? null,
          payload: {
            source: "pixeloffice-ui",
          },
        }),
      });
      if (launchUrl) {
        const popup = window.open(launchUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          setGo3dStatus(
            `3D session created (${payload.sessionId}). Popup blocked — open the launch URL below.`
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to launch 3D view.";
      setGo3dStatus(`Go 3D failed: ${message}`);
    } finally {
      setGo3dBusy(false);
    }
  }, [selectedAgent?.id, showChat, showScrum, showTimeTasks, tasks]);

  if (showGenealogyLab) {
    return <GenealogyLab onNavigate={() => setShowGenealogyLab(false)} />;
  }

  if (showAdminAssistant) {
    return <AdminAssistant onNavigate={() => setShowAdminAssistant(false)} />;
  }

   if (showStockForecasts) {
     return <StockForecasts />;
   }

   return (
     <div style={styles.container}>
       <div style={{...styles.sidebar, width: sidebarWidth}}>
         <div 
           style={styles.resizeHandle}
           onMouseDown={() => setIsResizing(true)}
         />
         <div style={{ marginBottom: '16px' }}>
           <button 
             style={styles.paramsToggle}
             onClick={() => setShowParams(!showParams)}
           >
             {showParams ? "▼ Hide Parameters" : "▶ Show Parameters"}
           </button>
         </div>
          <div style={{ marginBottom: '16px' }}>
            <button 
              style={{...styles.paramsToggle, marginLeft: '0px', background: showTaskManager ? '#1a2a2a' : '#0a0a12', opacity: 0.6, fontSize: '11px', borderColor: '#3a3a3a'}}
              onClick={() => setShowTaskManager(!showTaskManager)}
              title="Legacy task manager - please use Time + Tasks instead"
            >
              {showTaskManager ? "▼ Legacy Tasks" : "▶ Legacy Tasks (deprecated)"}
            </button>
          </div>
           <div style={{ marginBottom: '16px' }}>
             <button 
               style={{...styles.paramsToggle, marginLeft: '0px', background: showTimeTasks ? '#1a2a2a' : '#0a0a12', borderColor: '#4ecdc4'}}
               onClick={() => setShowTimeTasks(!showTimeTasks)}
             >
               {showTimeTasks ? "▼ Tasks v2" : "▶ Tasks v2"}
             </button>
           </div>
          <div style={{ marginBottom: '16px' }}>
            <button 
              style={{...styles.paramsToggle, marginLeft: '0px', background: showScrum ? '#1a2a2a' : '#0a0a12'}}
              onClick={() => setShowScrum(!showScrum)}
            >
              {showScrum ? "▼ SCRUM" : "▶ SCRUM"}
            </button>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <button 
              style={{...styles.paramsToggle, marginLeft: '0px', background: showChat ? '#1a2a2a' : '#0a0a12'}}
              onClick={() => setShowChat(!showChat)}
            >
              {showChat ? "▼ Chat" : "▶ Chat"}
            </button>
          </div>
         <div style={{ marginBottom: '16px' }}>
           <button 
             id="train-btn"
             style={{...styles.paramsToggle, marginLeft: '0px', background: '#4ecdc4'}}
             onClick={(e) => {
               const button = e.currentTarget as HTMLButtonElement;
               const debugLine = document.getElementById('debug-line');
               const now = new Date().toLocaleTimeString();
               
               button.disabled = true;
               button.textContent = '...';
               if (debugLine) debugLine.textContent = `[${now}] Triggering agentlightning_training...`;
               
               fetch('/api/agentlightning/train', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ agentId: 'anonymous' })
               })
               .then(response => response.json())
               .then(data => {
                 console.log('Training started:', data);
                 if (debugLine) debugLine.textContent = `[${now}] OK: training started ${data.workflow_id || 'unknown'}`;
                 setTimeout(() => { 
                   button.disabled = false;
                   button.textContent = 'Train';
                 }, 2000);
               })
               .catch(error => {
                 console.error('Training error:', error);
                 if (debugLine) debugLine.textContent = `[${now}] FAIL: ${error.message || 'Unknown error'}`;
                 setTimeout(() => {
                   button.disabled = false;
                   button.textContent = 'Train';
                 }, 2000);
               });
             }}
            >
              Train
            </button>
          </div>
           <div style={{ marginBottom: '16px' }}>
            <button 
              id="coolertalk-btn"
              style={{...styles.paramsToggle, marginLeft: '0px', background: '#7c5cbf'}}
              onClick={(e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const debugLine = document.getElementById('debug-line');
                const now = new Date().toLocaleTimeString();
                
                button.disabled = true;
                button.textContent = '...';
                if (debugLine) debugLine.textContent = `[${now}] Triggering cooler talk...`;
                
                 fetch(`/api/rooms/kitchen/cooler/run-turn`, {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({
                     topic: "Office life and system performance",
                     participants: ["FrontDesk", "OpenClaw", "IronClaw", "LeslieClaw", "ZeroClaw", "Sherlobster", "HermitClaw", "Hercule Prawnro"]
                   })
                 })
                .then(response => response.json())
                .then(data => {
                  console.log('Cooler talk started:', data);
                  if (debugLine) debugLine.textContent = `[${now}] OK: cooler talk started with ${data.participantCount || 0} agents`;
                  
                  // Set active conversation zone to kitchen (Cooler Talk location)
                  setActiveConversationZone("kitchen");
                  
                  // Update zone activity to show conversation
                  setZoneActivity(prev => {
                    const newMap = new Map(prev);
                    const kitchenActivity = newMap.get("kitchen") || {
                      zoneId: "kitchen",
                      agentCount: 0,
                      busyLevel: "quiet",
                      lastActivity: Date.now(),
                      conversationActive: false,
                    };
                    kitchenActivity.conversationActive = true;
                    newMap.set("kitchen", kitchenActivity);
                    return newMap;
                  });
                  
                  // Move agents to kitchen (without dialogue initially)
                  setAgents(prevAgents => {
                    return prevAgents.map(agent => {
                      const assignment = data.assignments?.find((a: any) => a.agentId === agent.id);
                      
                      if (assignment) {
                        return {
                          ...agent,
                          targetX: assignment.targetX,
                          targetY: assignment.targetY,
                          mode: "walking" as const,
                          status: "idle" as const,
                          thoughtBubble: undefined, // Clear any existing bubble
                        };
                      }
                      return agent;
                    });
                  });
                  
                  // Clear any existing timers
                  if (coolerTalkTimerRef.current) clearInterval(coolerTalkTimerRef.current);
                  if (coolerTalkEndTimerRef.current) clearTimeout(coolerTalkEndTimerRef.current);
                  
                  // Set up staggered dialogue timing
                  const dialogues = data.dialogues || [];
                  let dialogueIndex = 0;
                  
                  // Check and show dialogues based on showAt time
                  coolerTalkTimerRef.current = setInterval(() => {
                    const now = Date.now();
                    
                    setAgents(prevAgents => {
                      return prevAgents.map(agent => {
                        // Find if this agent has a dialogue that should show now
                        const dialogue = dialogues.find((d: any) => 
                          d.agentId === agent.id && 
                          d.showAt && 
                          now >= d.showAt && 
                          now < d.expiresAt
                        );
                        
                        if (dialogue) {
                          return {
                            ...agent,
                            thoughtBubble: {
                              text: dialogue.text,
                              expiresAt: dialogue.expiresAt,
                            },
                          };
                        }
                        
                        // Clear bubble if expired
                        if (agent.thoughtBubble && now > (agent.thoughtBubble as any).expiresAt) {
                          return {
                            ...agent,
                            thoughtBubble: undefined,
                          };
                        }
                        
                        return agent;
                      });
                    });
                    
                    dialogueIndex++;
;
                  }, 500);
                  
                  // End cooler talk after all dialogues shown + buffer
                  coolerTalkEndTimerRef.current = setTimeout(() => {
                    // Clear dialogue bubbles
                    setAgents(prevAgents => prevAgents.map(agent => ({
                      ...agent,
                      thoughtBubble: undefined,
                    })));
                    
                    // Return agents to their desks
                    setAgents(prevAgents => prevAgents.map(agent => {
                      const target = CHAIR_POSITIONS[agent.deskIndex];
                      return {
                        ...agent,
                        targetX: target.x,
                        targetY: target.y,
                        mode: "walking",
                        status: "working",
                      };
                    }));
                    
                    if (coolerTalkTimerRef.current) {
                      clearInterval(coolerTalkTimerRef.current);
                      coolerTalkTimerRef.current = null;
                    }
                    
                    // Clear active conversation zone
                    setActiveConversationZone(null);
                    setZoneActivity(prev => {
                      const newMap = new Map(prev);
                      const kitchenActivity = newMap.get("kitchen");
                      if (kitchenActivity) {
                        kitchenActivity.conversationActive = false;
                        newMap.set("kitchen", kitchenActivity);
                      }
                      return newMap;
                    });
                    
                    if (debugLine) debugLine.textContent = `[${new Date().toLocaleTimeString()}] Cooler talk ended, agents returning to desks`;
                  }, 60000);
                  
                  setTimeout(() => { 
                    button.disabled = false;
                    button.textContent = 'Cooler Talk';
                  }, 2000);
                })
                .catch(error => {
                  console.error('Cooler talk error:', error);
                  if (debugLine) debugLine.textContent = `[${now}] FAIL: ${error.message || 'Unknown error'}`;
                  setTimeout(() => {
                    button.disabled = false;
                    button.textContent = 'Cooler Talk';
                  }, 2000);
                });
              }}
            >
              Cooler Talk
            </button>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <button
              id="scrum-btn"
              style={{...styles.paramsToggle, marginLeft: '0px', background: '#2ecc71'}}
              onClick={(e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const debugLine = document.getElementById('debug-line');
                const now = new Date().toLocaleTimeString();
                
                button.disabled = true;
                button.textContent = 'Running...';
                if (debugLine) debugLine.textContent = `[${now}] Starting SCRUM session...`;
                
                // Conference room seats (agents will sit here)
                const CONFERENCE_SEATS = [
                  { x: 730, y: 95 },   // Seat 1
                  { x: 780, y: 95 },   // Seat 2  
                  { x: 830, y: 95 },   // Seat 3
                  { x: 880, y: 95 },   // Seat 4
                  { x: 730, y: 145 },  // Seat 5
                  { x: 780, y: 145 },  // Seat 6
                  { x: 830, y: 145 },  // Seat 7
                  { x: 880, y: 145 },  // Seat 8
                ];
                
                // SCRUM stage animations with messages
                const SCRUM_STAGES = [
                  { stage: 'check', agent: 'clerk', message: '📋 Checking repo status...', duration: 3000 },
                  { stage: 'report', agent: 'clerk', message: '📊 Reporting findings...', duration: 3500 },
                  { stage: 'review', agent: 'specialist', message: '🔍 Reviewing changes...', duration: 3000 },
                  { stage: 'decide', agent: 'executive', message: '⚖️ Making decisions...', duration: 3500 },
                  { stage: 'execute', agent: 'clerk', message: '🚀 Executing plan...', duration: 3000 },
                  { stage: 'log', agent: 'archivist', message: '📝 Logging session...', duration: 2500 },
                ];
                
                // Phase 1: Agents walk to conference room
                if (debugLine) debugLine.textContent = `[${now}] Phase 1: Walking to conference room...`;
                
                setAgents(prevAgents => prevAgents.map((agent, i) => {
                  const pos = CONFERENCE_SEATS[i % CONFERENCE_SEATS.length];
                  return { 
                    ...agent, 
                    targetX: pos.x, 
                    targetY: pos.y, 
                    mode: "walking" as const, 
                    status: "idle" as const, 
                    thoughtBubble: undefined 
                  };
                }));
                setActiveConversationZone("conference");
                
                // Phase 2: Agents sit down (after walking animation completes)
                setTimeout(() => {
                  if (debugLine) debugLine.textContent = `[${new Date().toLocaleTimeString()}] Phase 2: Taking seats...`;
                  
                  setAgents(prevAgents => prevAgents.map((agent, i) => {
                    const pos = CONFERENCE_SEATS[i % CONFERENCE_SEATS.length];
                    return { 
                      ...agent, 
                      x: pos.x, 
                      y: pos.y,
                      mode: "sitting" as const, 
                      status: "idle" as const,
                      thoughtBubble: { text: '🤔 Ready for SCRUM', expiresAt: Date.now() + 5000 }
                    };
                  }));
                  
                  // Phase 3: Run SCRUM stages with animations
                  let stageIndex = 0;
                  
                  const runNextStage = () => {
                    if (stageIndex >= SCRUM_STAGES.length) {
                      // Phase 4: End of SCRUM
                      if (debugLine) debugLine.textContent = `[${new Date().toLocaleTimeString()}] SCRUM complete!`;
                      
                      setAgents(prevAgents => prevAgents.map(agent => ({
                        ...agent,
                        thoughtBubble: { text: '✅ SCRUM complete!', expiresAt: Date.now() + 2000 }
                      })));
                      
                      // Phase 5: Agents stand up and return to desks
                      setTimeout(() => {
                        if (debugLine) debugLine.textContent = `[${new Date().toLocaleTimeString()}] Returning to desks...`;
                        
                        setAgents(prevAgents => prevAgents.map(agent => {
                          const target = CHAIR_POSITIONS[agent.deskIndex];
                          return { 
                            ...agent, 
                            targetX: target.x, 
                            targetY: target.y, 
                            mode: "walking" as const, 
                            status: "working" as const,
                            thoughtBubble: undefined
                          };
                        }));
                        setActiveConversationZone(null);
                        
                        setTimeout(() => {
                          setAgents(prevAgents => prevAgents.map(agent => {
                            const target = CHAIR_POSITIONS[agent.deskIndex];
                            return { 
                              ...agent, 
                              x: target.x, 
                              y: target.y,
                              mode: "idle-wander" as const
                            };
                          }));
                          
                          button.disabled = false;
                          button.textContent = 'Test SCRUM';
                        }, 3000);
                      }, 2500);
                      return;
                    }
                    
                    const currentStage = SCRUM_STAGES[stageIndex];
                    if (debugLine) debugLine.textContent = `[${new Date().toLocaleTimeString()}] Stage ${stageIndex + 1}/6: ${currentStage.stage.toUpperCase()}`;
                    
                    // Show stage message as thought bubble on appropriate agents
                    setAgents(prevAgents => prevAgents.map(agent => {
                      const shouldShowMessage = agent.role === currentStage.agent || 
                        (currentStage.agent === 'clerk' && ['clerk', 'receptionist'].includes(agent.role));
                      return {
                        ...agent,
                        thoughtBubble: shouldShowMessage 
                          ? { text: currentStage.message, expiresAt: Date.now() + currentStage.duration }
                          : undefined
                      };
                    }));
                    
                    // Call the backend to advance SCRUM stage
                    fetch('/api/scrum/advance', { method: 'POST' })
                      .then(r => r.json())
                      .then(data => {
                        if (debugLine && data.stageResult) {
                          debugLine.textContent = `[${new Date().toLocaleTimeString()}] ${currentStage.stage}: ${JSON.stringify(data.stageResult.output).substring(0, 80)}...`;
                        }
                      })
                      .catch(err => console.error('SCRUM stage error:', err));
                    
                    stageIndex++;
                    setTimeout(runNextStage, currentStage.duration);
                  };
                  
                  // Start the first stage after a brief pause
                  setTimeout(runNextStage, 2000);
                }, 2500);
              }}
            >
              Test SCRUM
            </button>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <button
              id="go3d-btn"
              style={{
                ...styles.paramsToggle,
                marginLeft: "0px",
                background: go3dBusy ? "#2d3f52" : "#3f8cff",
              }}
              onClick={() => {
                void handleGo3D();
              }}
              disabled={go3dBusy}
              title="Create a Pixel Office 3D session and open Claw3D"
            >
              {go3dBusy ? "Launching 3D..." : "Go 3D"}
            </button>
            {go3dStatus ? (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#9bb8ff" }}>{go3dStatus}</div>
            ) : null}
            {go3dSessionId ? (
              <div style={{ marginTop: "4px", fontSize: "11px", color: "#7d89a3" }}>
                Session: {go3dSessionId}
              </div>
            ) : null}
            {go3dLaunchUrl ? (
              <a
                href={go3dLaunchUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: "6px", display: "inline-block", fontSize: "11px", color: "#7fd0ff" }}
              >
                Open Claw3D manually
              </a>
            ) : null}
          </div>
          {showParams && (
           <Dashboard
             config={dashboardConfig}
             onUpdate={updateConfig}
             agents={agents}
             onOpenGenealogyLab={() => setShowGenealogyLab(true)}
             onOpenAdminAssistant={() => setShowAdminAssistant(true)}
             onOpenStockForecasts={() => setShowStockForecasts(true)}
           />
         )}
          {showTaskManager && (
            <TaskManager
              tasks={tasks}
              agents={agents}
              onUpdateTask={updateTask}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onClose={() => setShowTaskManager(false)}
            />
          )}
          {showTimeTasks && (
            <TimeTasksPanel onClose={() => setShowTimeTasks(false)} />
          )}
          {showScrum && (
            <ScrumPanel />
          )}
          {showChat && (
            <ChatOverlay onClose={() => setShowChat(false)} />
          )}
       </div>
       <div style={styles.mainContent}>
         <div style={styles.canvasWrapper} ref={containerRef}>
           <canvas
             ref={canvasRef}
             style={styles.canvas}
             onClick={handleCanvasClick}
           />
            {selectedAgent && (
              <AgentActionCard
                agent={selectedAgent}
                workflowState={workflowState}
                setWorkflowState={setWorkflowState}
                onClose={() => setSelectedAgent(null)}
                onAssignTask={(taskId) => {
                 updateTask(taskId, { assigneeId: selectedAgent.id });
                 setSelectedAgent(null);
               }}
               tasks={tasks.filter(t => !t.assigneeId || t.assigneeId === selectedAgent.id)}
               onMoodChange={(mood) => {
                 setAgents(prev => prev.map(a => 
                   a.id === selectedAgent.id ? updateAgentMood(a, mood) : a
                 ));
                 setSelectedAgent(prev => prev ? updateAgentMood(prev, mood) : null);
               }}
             />
           )}
         </div>
       </div>
     </div>
   );
}

interface WorkflowState {
  taskId: string;
  currentStep: number;
  totalSteps: number;
  currentAgent: string;
  status: "running" | "completed" | "failed";
  message: string;
}

interface AgentActionCardProps {
  agent: Agent;
  workflowState: WorkflowState | null;
  setWorkflowState: (state: WorkflowState | null) => void;
  onClose: () => void;
  onAssignTask: (taskId: string) => void;
  tasks: Task[];
  onMoodChange?: (mood: typeof MOOD_OPTIONS[number]) => void;
}

interface DashboardProps {
  config: DashboardConfig;
  onUpdate: (updates: Partial<DashboardConfig>) => void;
  agents: Agent[];
  onOpenGenealogyLab: () => void;
  onOpenAdminAssistant: () => void;
  onOpenStockForecasts: () => void;
}

function Dashboard({ config, onUpdate, agents, onOpenGenealogyLab, onOpenAdminAssistant, onOpenStockForecasts }: DashboardProps) {
  const workingCount = agents.filter(a => a.status === "working").length;
  const idleCount = agents.filter(a => a.status === "idle").length;
  
  return (
    <div style={styles.dashboard}>
      <div style={styles.dashboardHeader}>
        <h3 style={styles.dashboardTitle}>Parameters</h3>
        <button
          onClick={onOpenAdminAssistant}
          style={{...styles.commandLink, marginLeft: '8px', cursor: 'pointer', background: 'transparent'}}
        >
          🎛️ Admin Cockpit ↗
        </button>
        <button
          onClick={onOpenGenealogyLab}
          style={{...styles.commandLink, marginLeft: '8px', cursor: 'pointer', background: 'transparent'}}
        >
          Genealogy Lab
        </button>
        <button
          onClick={onOpenStockForecasts}
          style={{...styles.commandLink, marginLeft: '8px', cursor: 'pointer', background: 'transparent'}}
        >
          Stock Forecasts
        </button>
        <a 
          href="http://localhost:4173/command" 
          target="_blank"
          style={{...styles.commandLink, marginLeft: 'auto'}}
        >
          Terminal ↗
        </a>
        <a
          href="http://127.0.0.1:5190"
          target="_blank"
          rel="noreferrer"
          style={{ ...styles.commandLink, marginLeft: '8px' }}
        >
          Sherlock CS ↗
        </a>
        <a
          href="http://185.211.4.97"
          target="_blank"
          rel="noreferrer"
          style={{ ...styles.commandLink, marginLeft: '8px' }}
        >
          NightWatchauton ↗
        </a>
        <a
          href="http://localhost:3847"
          target="_blank"
          rel="noreferrer"
          style={{ ...styles.commandLink, marginLeft: '8px' }}
        >
          ClawGuard ↗
        </a>
      </div>
      
      <div style={{...styles.dashboardSection, border: `1px solid ${COLORS.wallBorder}`, padding: '10px', borderRadius: '4px', marginBottom: '16px'}}>
        <label style={{...styles.label, color: '#4ecdc4', fontWeight: 600}}>
          <input
            type="checkbox"
            checked={config.liveMode}
            onChange={(e) =>
              onUpdate({
                liveMode: e.target.checked,
                mockMode: !e.target.checked,
              })
            }
            style={styles.checkbox}
          />
          Live Agent Mode
        </label>
      </div>

      <div style={{...styles.dashboardSection, border: `1px solid ${COLORS.wallBorder}`, padding: '10px', borderRadius: '4px', marginBottom: '16px'}}>
        <label style={{...styles.label, color: '#feca57', fontWeight: 600}}>
          <input
            type="checkbox"
            checked={config.viewMode === "operator"}
            onChange={(e) =>
              onUpdate({
                viewMode: e.target.checked ? "operator" : "public",
              })
            }
            style={styles.checkbox}
          />
          Operator View (ignore privacy)
        </label>
      </div>
      
      <div style={styles.dashboardSection}>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={config.mockMode}
            onChange={(e) => onUpdate({ mockMode: e.target.checked })}
            style={styles.checkbox}
          />
          Mock Mode (auto-toggle status)
        </label>
      </div>

      <div style={styles.dashboardSection}>
        <label style={styles.label}>
          Mock Toggle Speed: {config.mockToggleSpeed}ms
          <input
            type="range"
            min="1000"
            max="15000"
            step="500"
            value={config.mockToggleSpeed}
            onChange={(e) => onUpdate({ mockToggleSpeed: Number(e.target.value) })}
            style={styles.slider}
          />
        </label>
      </div>

      <div style={styles.dashboardSection}>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={config.showStatusBar}
            onChange={(e) => onUpdate({ showStatusBar: e.target.checked })}
            style={styles.checkbox}
          />
          Show Status Bar
        </label>
      </div>

      <div style={styles.dashboardSection}>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={config.showNames}
            onChange={(e) => onUpdate({ showNames: e.target.checked })}
            style={styles.checkbox}
          />
          Show Agent Names
        </label>
      </div>

      <div style={styles.dashboardSection}>
        <label style={styles.label}>
          Animation Speed: {config.animationSpeed.toFixed(1)}
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={config.animationSpeed}
            onChange={(e) => onUpdate({ animationSpeed: Number(e.target.value) })}
            style={styles.slider}
          />
        </label>
      </div>

      <div style={styles.dashboardSection}>
        <label style={styles.label}>
          Canvas Scale: {config.canvasScale.toFixed(1)}x
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={config.canvasScale}
            onChange={(e) => onUpdate({ canvasScale: Number(e.target.value) })}
            style={styles.slider}
          />
        </label>
      </div>

      <div style={styles.stats}>
        <span>Agents: {agents.length}</span>
        <span>Working: {workingCount}</span>
        <span>Idle: {idleCount}</span>
      </div>
    </div>
  );
}

function AgentActionCard({ 
  agent, 
  workflowState,
  setWorkflowState,
  onClose, 
  onAssignTask,
  tasks,
  onMoodChange
}: AgentActionCardProps) {
  const unassignedTasks = tasks.filter(t => !t.assigneeId);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("dash-squirrel");
  const [isLoading, setIsLoading] = useState(false);
  
  // GitHub workflow state
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubResult, setGithubResult] = useState<GithubReadmeWorkflowResponse | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [currentFetch, setCurrentFetch] = useState<{ owner: string; repo: string } | null>(null);
  
  // SitRep workflow state
  const [showSitRepModal, setShowSitRepModal] = useState(false);
  const [sitRepResult, setSitRepResult] = useState<SitRepResponse | null>(null);
  const [sitRepLoading, setSitRepLoading] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [sitRepError, setSitRepError] = useState<string | null>(null);
  const [sitRepAnimating, setSitRepAnimating] = useState(false);
  
  // Agent card state for model status
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  
  useEffect(() => {
    loadAgentCards().then(cards => {
      const card = cards.find(c => c.id === agent.id);
      if (card) {
        setAgentCard(card);
        // Auto-select the agent's configured primary model
        if (card.models?.primary?.name) {
          setSelectedModel(card.models.primary.name);
        }
      }
    });
  }, [agent.id]);
  
  const modelStatus = agentCard?.models?.primary?.status;
  const modelName = agentCard?.models?.primary?.name;
  const fallbackModel = agentCard?.models?.fallback?.name;
  
  const availableModels = [
    { id: "gemma-clerk", name: "Gemma Clerk" },
    { id: "physics-assistant:latest", name: "Physics Assistant (Latest)" },
    { id: "physics-assistant", name: "Physics Assistant" },
    { id: "dash-squirrel", name: "Dash Squirrel" },
    { id: "night-dreamer", name: "Night Dreamer" },
    { id: "night-auditor", name: "Night Auditor" },
    { id: "night-ponderer", name: "Night Ponderer" },
    { id: "comedian", name: "Comedian" },
    { id: "gemma-3-1b-it", name: "Gemma 3" },
    { id: "smollm", name: "SmolLM" },
    { id: "phi3:mini", name: "Phi-3 Mini" },
    { id: "tinyllama", name: "TinyLlama" },
    { id: "potatopeeler", name: "Potato Peeler" },
    { id: "potatowasher", name: "Potato Washer" },
  ];

  const isReceptionist = agent.role === "receptionist";
  
  const workflowSteps = [
    { agent: "frontdesk", message: "Receptionist processing request...", delay: 2000 },
    { agent: "openclaw", message: "Clerk routing to specialist...", delay: 2500 },
    { agent: "zeroclaw", message: "Specialist fetching from GitHub...", delay: 3000 },
    { agent: "hermitclaw", message: "Archivist archiving results...", delay: 2000 },
  ];
  
  // SitRep workflow - different animation style
  const sitrepSteps = [
    { agent: "frontdesk", message: "Receptionist capturing request...", delay: 1500 },
    { agent: "zeroclaw", message: "Specialist drafting report...", delay: 2500 },
    { agent: "leslieclaw", message: "Executive reviewing...", delay: 2000 },
    { agent: "hermitclaw", message: "Archivist archiving...", delay: 1500 },
  ];
  
  const runSitRepWorkflow = async (scope: string, detailLevel: string) => {
    setSitRepLoading(true);
    setSitRepError(null);
    setShowSitRepModal(false);
    setSitRepAnimating(true);
    
    // Visual animation with different timing
    for (let i = 0; i < sitrepSteps.length; i++) {
      const step = sitrepSteps[i];
      setWorkflowState({
        taskId: "sitrep-visual",
        currentStep: i,
        totalSteps: sitrepSteps.length,
        currentAgent: step.agent,
        status: "running",
        message: step.message
      });
      
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }
    
    // Now fetch real data
    setSitRepAnimating(false);
    
    try {
      const response = await fetch('http://localhost:4173/api/workflow/office/sitrep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, detailLevel })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      setSitRepResult(data);
    } catch (err: any) {
      console.error("SitRep workflow error:", err);
      setSitRepError(err.message || "Failed to generate SitRep");
    } finally {
      setSitRepLoading(false);
    }
  };
  
  const runVisualWorkflow = async (owner: string, repo: string, token?: string) => {
    setCurrentFetch({ owner, repo });
    setGithubLoading(true);
    setGithubError(null);
    setShowGithubModal(false);
    
    // Start visual workflow animation
    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i];
      setWorkflowState({
        taskId: "visual",
        currentStep: i,
        totalSteps: workflowSteps.length,
        currentAgent: step.agent,
        status: "running",
        message: step.message
      });
      
      // Wait for the step delay (simulated work)
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }
    
    // All visual steps complete, now fetch real data
    try {
      const response = await fetch('http://localhost:4173/api/workflow/github/readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, token })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Show completion
      if (workflowState) {
        setWorkflowState({
          ...workflowState,
          status: "completed",
          message: "Workflow complete!"
        });
      }
      
      setGithubResult(data);
      
      // Clear workflow after showing completion
      setTimeout(() => {
        setWorkflowState(null);
        setCurrentFetch(null);
      }, 2000);
      
    } catch (err: any) {
      console.error("GitHub workflow error:", err);
      setGithubError(err.message || "Failed to complete request");
      if (workflowState) {
        setWorkflowState({
          ...workflowState,
          status: "failed",
          message: "Workflow failed"
        });
      }
    } finally {
      setGithubLoading(false);
    }
  };
  
  const handleGithubSubmit = runVisualWorkflow;
  
  const handleSendChat = () => {
    if (!chatInput.trim() || isLoading) return;
    
    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setIsLoading(true);
    
    fetch('/api/agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: userMessage,
        model: selectedModel,
        agentName: agent.name,
        agentRole: agent.role
      })
    })
    .then(response => response.json())
    .then(data => {
      setIsLoading(false);
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: "agent", content: data.reply }]);
      } else if (data.error) {
        setChatMessages(prev => [...prev, { role: "agent", content: `Error: ${data.error}` }]);
      }
    })
    .catch(error => {
      setIsLoading(false);
      setChatMessages(prev => [...prev, { role: "agent", content: `Error: ${error.message}` }]);
    });
  };
  
  return (
    <div style={actionCardStyles.overlay} onClick={onClose}>
      <div style={actionCardStyles.card} onClick={e => e.stopPropagation()}>
        <div style={actionCardStyles.header}>
          <div style={{...actionCardStyles.avatar, backgroundColor: agent.color}}>
            {agent.name.charAt(0)}
          </div>
          <div>
            <h3 style={actionCardStyles.name}>{agent.name}</h3>
            <span style={actionCardStyles.role}>{agent.role}</span>
          </div>
          <button style={actionCardStyles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <div style={actionCardStyles.statusRow}>
          <span style={{
            ...actionCardStyles.statusDot,
            background: agent.status === 'working' ? COLORS.statusWorking : COLORS.statusIdle
          }} />
          <span style={actionCardStyles.statusText}>
            {agent.status === 'working' ? 'Working' : 'Idle'}
          </span>
          <span style={actionCardStyles.visibilityBadge}>
            {agent.visibility || 'public'}
          </span>
          {modelStatus && (
            <span style={{
              ...actionCardStyles.visibilityBadge,
              background: modelStatus === 'local-ready' ? '#26de81' : modelStatus === 'local-unavailable' ? '#feca57' : '#4a90d9',
              color: '#050509',
              marginLeft: 'auto'
            }}>
              {modelStatus === 'local-ready' ? 'Local' : modelStatus === 'local-unavailable' ? 'Local missing' : 'Remote'}
            </span>
          )}
        </div>
        
        {modelName && (
          <div style={{...actionCardStyles.statusRow, padding: '4px 14px', fontSize: '11px'}}>
            <span style={{color: '#707080'}}>Model: </span>
            <span style={{color: '#a0a0b0'}}>{modelName}</span>
            {fallbackModel && (
              <>
                <span style={{color: '#505060', marginLeft: '12px'}}>Fallback: </span>
                <span style={{color: '#606070'}}>{fallbackModel}</span>
              </>
            )}
          </div>
        )}

        <div style={actionCardStyles.section}>
          <h4 style={actionCardStyles.sectionTitle}>Mood: {getMoodEmoji(agent.mood)}</h4>
          <div style={actionCardStyles.moodGrid}>
            {MOOD_OPTIONS.map(mood => (
              <button
                key={mood}
                style={{
                  ...actionCardStyles.moodBtn,
                  borderColor: agent.mood === mood ? '#4ecdc4' : '#2a3548',
                }}
                onClick={() => onMoodChange?.(mood)}
              >
                {getMoodEmoji(mood)}
              </button>
            ))}
          </div>
        </div>

        <div style={actionCardStyles.section}>
          <h4 style={actionCardStyles.sectionTitle}>Quick Actions</h4>
          <div style={actionCardStyles.actions}>
            <button 
              style={actionCardStyles.actionBtn}
              onClick={onClose}
            >
              View Full Profile
            </button>
            {isReceptionist && (
              <>
                <select 
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#1a2538',
                    border: '1px solid #3a4a5a',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                  value={selectedWorkflow}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedWorkflow(value);
                    if (value === 'readme') setShowGithubModal(true);
                    else if (value === 'sitrep') setShowSitRepModal(true);
                    else if (value === 'write-readme') setShowGithubModal(true);
                    else if (value === 'nightly') {
                      // Handle nightly report - will be implemented
                      alert('Nightly report workflow coming soon!');
                      setSelectedWorkflow("");
                    }
                  }}
                >
                  <option value="">Select Workflow...</option>
                  <option value="readme">Fetch GitHub README</option>
                  <option value="write-readme">Write README Section</option>
                  <option value="sitrep">Generate Office SitRep</option>
                  <option value="nightly">Generate Nightly Report</option>
                </select>
              </>
            )}
          </div>
        </div>

        {workflowState && (
          <div style={actionCardStyles.section}>
            <div style={{
              background: '#0a1520',
              border: '1px solid #2a3a4a',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '12px'
            }}>
              <div style={{
                color: '#4ecdc4',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {workflowState.status === 'running' && (
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#4ecdc4',
                    animation: 'pulse 1s infinite'
                  }} />
                )}
                {workflowState.status === 'completed' && '✓'}
                {workflowState.status === 'failed' && '✗'}
                {workflowState.message}
              </div>
              
              {/* Progress bar */}
              <div style={{
                height: '6px',
                background: '#1a2a3a',
                borderRadius: '3px',
                marginBottom: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${((workflowState.currentStep + 1) / workflowState.totalSteps) * 100}%`,
                  background: workflowState.status === 'completed' ? '#26de81' : workflowState.status === 'failed' ? '#fc5c65' : '#4ecdc4',
                  transition: 'width 0.5s ease-out',
                  borderRadius: '3px'
                }} />
              </div>
              
              {/* Step indicators */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                {['Receptionist', 'Clerk', 'Specialist', 'Archivist'].map((step, idx) => {
                  const isActive = idx === workflowState.currentStep;
                  const isComplete = idx < workflowState.currentStep || workflowState.status === 'completed';
                  return (
                    <div key={step} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isComplete ? '#26de81' : isActive ? '#4ecdc4' : '#2a3a4a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: isComplete || isActive ? '#050509' : '#606070',
                        transition: 'all 0.3s ease',
                        boxShadow: isActive ? '0 0 10px #4ecdc4' : 'none'
                      }}>
                        {isComplete ? '✓' : idx + 1}
                      </div>
                      <span style={{
                        fontSize: '9px',
                        color: isActive ? '#4ecdc4' : isComplete ? '#26de81' : '#505060'
                      }}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Typing indicator when at specialist step */}
              {workflowState.currentAgent === 'zeroclaw' && workflowState.status === 'running' && (
                <div style={{
                  marginTop: '12px',
                  color: '#707080',
                  fontSize: '11px',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  <span style={{ display: 'inline-block', width: '4px', height: '14px', background: '#4ecdc4', animation: 'blink 1s infinite', marginRight: '4px' }} />
                  Fetching {currentFetch ? `${currentFetch.owner}/${currentFetch.repo}` : 'repository'}...
                </div>
              )}
            </div>
          </div>
        )}

        {githubLoading && !workflowState && (
          <div style={actionCardStyles.section}>
            <div style={{color: '#4ecdc4', fontSize: '13px', textAlign: 'center', padding: '12px'}}>
              Receptionist is processing your GitHub request...
            </div>
          </div>
        )}

        {githubError && (
          <div style={actionCardStyles.section}>
            <div style={{color: '#fc5c65', fontSize: '13px', textAlign: 'center', padding: '12px', background: '#1a0a0a', borderRadius: '6px'}}>
              We couldn't complete that request. Please check the repo name or try again.
            </div>
          </div>
        )}

        {githubResult && (
          <WorkflowResultPanel 
            result={githubResult} 
            onClose={() => setGithubResult(null)} 
          />
        )}

        {unassignedTasks.length > 0 && (
          <div style={actionCardStyles.section}>
            <h4 style={actionCardStyles.sectionTitle}>Assign Task</h4>
            <div style={actionCardStyles.taskList}>
              {unassignedTasks.slice(0, 3).map(task => (
                <button
                  key={task.id}
                  style={actionCardStyles.taskItem}
                  onClick={() => onAssignTask(task.id)}
                >
                  <span style={{
                    ...actionCardStyles.priorityDot,
                    background: task.priority === 'high' ? '#ff4b4b' : task.priority === 'medium' ? '#feca57' : '#4ecdc4'
                  }} />
                  {task.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={actionCardStyles.chatContainer}>
          <h4 style={actionCardStyles.sectionTitle}>Chat with {agent.name}</h4>
          <div style={actionCardStyles.modelSelect}>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={actionCardStyles.modelDropdown}
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          <div style={actionCardStyles.chatMessages}>
            {chatMessages.length === 0 && (
              <span style={{color: "#8888aa", fontSize: "11px", textAlign: "center"}}>
                Ask {agent.name} anything...
              </span>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...actionCardStyles.chatMessage,
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  background: msg.role === "user" ? "#1a3a3a" : "#0f1520",
                  border: msg.role === "user" ? "1px solid #4ecdc4" : "1px solid #2a3a4a",
                  color: "#e0e8f0",
                }}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div style={{
                ...actionCardStyles.chatMessage,
                alignSelf: "flex-start",
                background: "#0f1520",
                border: "1px solid #2a3a4a",
                color: "#88aacc",
                fontStyle: "italic"
              }}>
                Thinking...
              </div>
            )}
          </div>
          <input
            style={actionCardStyles.chatInput}
            placeholder="Type a message..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
            disabled={isLoading}
          />
          <button style={actionCardStyles.chatSendBtn} onClick={handleSendChat} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {isReceptionist && (
          <GitHubReadmeModal
            isOpen={showGithubModal}
            onClose={() => setShowGithubModal(false)}
            onSubmit={handleGithubSubmit}
            isLoading={githubLoading}
          />
        )}

        {isReceptionist && (
          <SitRepModal
            isOpen={showSitRepModal}
            onClose={() => setShowSitRepModal(false)}
            onSubmit={runSitRepWorkflow}
            isLoading={sitRepLoading}
          />
        )}

        {isReceptionist && (sitRepLoading || sitRepAnimating) && (
          <SitRepWorkflowPanel isAnimating={sitRepAnimating} result={sitRepResult} />
        )}

        {isReceptionist && sitRepResult && !sitRepLoading && !sitRepAnimating && (
          <SitRepWorkflowPanel result={sitRepResult} onClose={() => setSitRepResult(null)} />
        )}

        {isReceptionist && sitRepError && (
          <div style={actionCardStyles.section}>
            <div style={{color: '#fc5c65', fontSize: '13px', textAlign: 'center', padding: '12px', background: '#1a0a0a', borderRadius: '6px'}}>
              {sitRepError}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskManager({ 
  tasks, 
  agents, 
  onUpdateTask, 
  onAddTask, 
  onDeleteTask,
  onClose 
}: { 
  tasks: Task[]; 
  agents: Agent[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onAddTask: (title: string, description: string, priority: TaskPriority) => void;
  onDeleteTask: (id: string) => void;
  onClose: () => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddTask(newTitle.trim(), newDesc.trim(), newPriority);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
    }
  };

  return (
    <div style={taskManagerStyles.container}>
      <div style={taskManagerStyles.header}>
        <h3 style={taskManagerStyles.title}>Task Manager</h3>
        <button style={taskManagerStyles.closeBtn} onClick={onClose}>×</button>
      </div>

      <div style={taskManagerStyles.stats}>
        <span style={taskManagerStyles.stat} onClick={() => setFilter('all')} data-active={filter === 'all'}>
          All ({tasks.length})
        </span>
        <span style={taskManagerStyles.stat} onClick={() => setFilter('todo')} data-active={filter === 'todo'}>
          Todo ({todoCount})
        </span>
        <span style={taskManagerStyles.stat} onClick={() => setFilter('in_progress')} data-active={filter === 'in_progress'}>
          In Progress ({inProgressCount})
        </span>
        <span style={taskManagerStyles.stat} onClick={() => setFilter('done')} data-active={filter === 'done'}>
          Done ({doneCount})
        </span>
      </div>

      <div style={taskManagerStyles.addForm}>
        <input
          style={taskManagerStyles.input}
          placeholder="Task title..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          style={{...taskManagerStyles.input, width: '200px'}}
          placeholder="Description (optional)"
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
        />
        <select 
          style={taskManagerStyles.select}
          value={newPriority}
          onChange={e => setNewPriority(e.target.value as TaskPriority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button style={taskManagerStyles.addBtn} onClick={handleAdd}>+</button>
      </div>

      <div style={taskManagerStyles.list}>
        {filteredTasks.map(task => {
          const assignee = agents.find(a => a.id === task.assigneeId);
          return (
            <div key={task.id} style={taskManagerStyles.taskItem}>
              <button
                style={taskManagerStyles.checkbox}
                onClick={() => {
                  const currentStatus = task.status;
                  let nextStatus: TaskStatus = "in_progress";
                  if (currentStatus === "todo" || currentStatus === "queued") {
                    nextStatus = "in_progress";
                  } else if (currentStatus === "in_progress") {
                    nextStatus = "completed";
                  } else if (currentStatus === "completed" || currentStatus === "done") {
                    nextStatus = "todo";
                  }
                  onUpdateTask(task.id, { status: nextStatus });
                }}
              >
                {task.status === 'done' || task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '◐' : '○'}
              </button>
              <div style={taskManagerStyles.taskContent}>
                <span style={{
                  ...taskManagerStyles.taskTitle,
                  textDecoration: task.status === 'done' || task.status === 'completed' ? 'line-through' : 'none',
                  opacity: task.status === 'done' || task.status === 'completed' ? 0.6 : 1,
                }}>
                  {task.title}
                </span>
                {task.description && (
                  <span style={taskManagerStyles.taskDesc}>{task.description}</span>
                )}
                <div style={taskManagerStyles.taskMeta}>
                  <span style={{
                    ...taskManagerStyles.priorityBadge,
                    background: task.priority === 'high' ? '#ff4b4b' : task.priority === 'medium' ? '#feca57' : '#4ecdc4'
                  }}>
                    {task.priority}
                  </span>
                  {assignee && (
                    <span style={{...taskManagerStyles.assignee, backgroundColor: assignee.color}}>
                      {assignee.name}
                    </span>
                  )}
                </div>
              </div>
              <button 
                style={taskManagerStyles.deleteBtn}
                onClick={() => onDeleteTask(task.id)}
              >
                ×
              </button>
            </div>
          );
        })}
        {filteredTasks.length === 0 && (
          <div style={taskManagerStyles.empty}>No tasks found</div>
        )}
      </div>
    </div>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ChatOverlay({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-10),
        }),
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        setMessages(prev => [...prev, { role: "assistant", content: `Error: Expected JSON but got ${contentType}` }]);
        return;
      }
      
      const data = await response.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: `Failed to send message: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={chatStyles.overlay}>
      <div style={chatStyles.container}>
        <div style={chatStyles.header}>
          <h3 style={chatStyles.title}>Chat with Agents</h3>
          <button style={chatStyles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <div style={chatStyles.messages}>
          {messages.length === 0 && (
            <div style={chatStyles.welcome}>
              <p>👋 Hi! I can help you explore your database.</p>
              <p>Try asking:</p>
              <ul>
                <li>"Show me what's in the database"</li>
                <li>"What tables exist?"</li>
                <li>"Show me the entities table"</li>
              </ul>
            </div>
          )}
          {messages.map((msg, i) => (
            <div 
              key={i} 
              style={{
                ...chatStyles.message,
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#1a3a3a" : "#0a0a12",
                border: msg.role === "user" ? "1px solid #4ecdc4" : `1px solid ${COLORS.wallBorder}`,
              }}
            >
              <div style={chatStyles.messageContent}>{msg.content}</div>
            </div>
          ))}
          {isLoading && (
            <div style={{...chatStyles.message, alignSelf: "flex-start", background: "#0a0a12", border: `1px solid ${COLORS.wallBorder}`}}>
              <div style={chatStyles.messageContent}>Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={chatStyles.inputArea}>
          <input
            style={chatStyles.input}
            placeholder="Ask about the database..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button 
            style={{...chatStyles.sendBtn, opacity: isLoading ? 0.5 : 1}} 
            onClick={sendMessage}
            disabled={isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    width: "100%",
    height: "100vh",
    background: COLORS.statusBarBg,
    overflow: "hidden",
    display: "flex",
  },
  sidebar: {
    minWidth: "200px",
    maxWidth: "500px",
    background: "#050509",
    borderRight: `1px solid ${COLORS.wallBorder}`,
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    gap: "12px",
    overflowY: "auto",
    overflowX: "hidden",
    position: "relative",
  },
  resizeHandle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "6px",
    cursor: "ew-resize",
    background: "transparent",
    zIndex: 10,
    transition: "background 0.2s",
  },
  mainContent: {
    flex: 1,
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  canvasWrapper: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    background: "#0a0a12",
  },
  canvas: {
    display: "block",
    width: "100%",
    height: "100%",
    imageRendering: "pixelated",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "16px",
  },
  paramsToggle: {
    padding: "8px 16px",
    background: "#1a2a2a",
    border: "1px solid #3a3a3a",
    color: COLORS.white,
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
    width: "100%",
  },
  dashboardSection: {
    marginBottom: "12px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#a0a0b0",
    fontSize: "13px",
    cursor: "pointer",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: COLORS.statusWorking,
    cursor: "pointer",
  },
  slider: {
    flex: 1,
    accentColor: COLORS.statusWorking,
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: "20px",
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: `1px solid ${COLORS.wallBorder}`,
    color: "#707080",
    fontSize: "12px",
  },
};

const actionCardStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  card: {
    background: "#0a0a12",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "12px",
    padding: "20px",
    width: "420px",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  avatar: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "bold",
    color: "#fff",
  },
  name: {
    margin: 0,
    color: COLORS.white,
    fontSize: "20px",
  },
  role: {
    color: "#707080",
    fontSize: "14px",
    textTransform: "capitalize",
  },
  closeBtn: {
    marginLeft: "auto",
    background: "transparent",
    border: "none",
    color: "#707080",
    fontSize: "28px",
    cursor: "pointer",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "16px",
    padding: "10px 14px",
    background: "#050509",
    borderRadius: "6px",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  statusText: {
    color: "#a0a0b0",
    fontSize: "14px",
  },
  visibilityBadge: {
    marginLeft: "auto",
    padding: "3px 10px",
    background: "#1a1a2e",
    borderRadius: "4px",
    color: "#707080",
    fontSize: "11px",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: "18px",
  },
  sectionTitle: {
    color: "#4ecdc4",
    fontSize: "13px",
    margin: "0 0 10px 0",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  actionBtn: {
    flex: 1,
    padding: "12px",
    background: "#1a1a2e",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "6px",
    color: COLORS.white,
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  taskItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    background: "#1a1a2e",
    border: "none",
    borderRadius: "4px",
    color: "#a0a0b0",
    fontSize: "12px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    fontFamily: "'JetBrains Mono', monospace",
  },
  priorityDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  moodGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "4px",
  },
  moodBtn: {
    padding: "6px",
    background: "#1a1a2e",
    border: "1px solid #2a3548",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  chatContainer: {
    marginTop: "16px",
    borderTop: `1px solid ${COLORS.wallBorder}`,
    paddingTop: "16px",
  },
  chatMessages: {
    maxHeight: "150px",
    overflowY: "auto",
    marginBottom: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  chatMessage: {
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    maxWidth: "85%",
  },
  chatInput: {
    width: "100%",
    padding: "10px",
    background: "#050509",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "6px",
    color: COLORS.white,
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
  },
  chatSendBtn: {
    marginTop: "8px",
    padding: "8px 16px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: "4px",
    color: "#050509",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
  },
  modelSelect: {
    marginBottom: "10px",
  },
  modelDropdown: {
    width: "100%",
    padding: "8px",
    background: "#1a1a25",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "4px",
    color: "#e0e8f0",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
    outline: "none",
  },
};

const taskManagerStyles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: "20px",
    padding: "20px",
    background: "#0a0a12",
    borderRadius: "8px",
    border: `1px solid ${COLORS.wallBorder}`,
    width: "100%",
    maxWidth: "800px",
    maxHeight: "500px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    color: COLORS.white,
    fontSize: "16px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#707080",
    fontSize: "20px",
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
  },
  stat: {
    padding: "6px 12px",
    background: "#1a1a2e",
    borderRadius: "4px",
    color: "#707080",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  addForm: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    background: "#050509",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "4px",
    color: COLORS.white,
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  select: {
    padding: "8px",
    background: "#050509",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "4px",
    color: COLORS.white,
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  addBtn: {
    padding: "8px 16px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: "4px",
    color: "#050509",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  taskItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    background: "#050509",
    borderRadius: "6px",
  },
  checkbox: {
    width: "24px",
    height: "24px",
    background: "transparent",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "4px",
    color: "#4ecdc4",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  taskContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  taskTitle: {
    color: COLORS.white,
    fontSize: "14px",
    margin: 0,
  },
  taskDesc: {
    color: "#707080",
    fontSize: "12px",
  },
  taskMeta: {
    display: "flex",
    gap: "8px",
    marginTop: "4px",
  },
  priorityBadge: {
    padding: "2px 6px",
    borderRadius: "3px",
    color: "#050509",
    fontSize: "10px",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  assignee: {
    padding: "2px 6px",
    borderRadius: "3px",
    color: COLORS.white,
    fontSize: "10px",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#ff4b4b",
    fontSize: "18px",
    cursor: "pointer",
    opacity: 0.6,
  },
  empty: {
    textAlign: "center",
    color: "#707080",
    padding: "40px",
    fontSize: "14px",
  },
};

const chatStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  container: {
    width: "600px",
    maxWidth: "90vw",
    maxHeight: "80vh",
    background: "#0a0a12",
    borderRadius: "12px",
    border: `1px solid ${COLORS.wallBorder}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: `1px solid ${COLORS.wallBorder}`,
  },
  title: {
    margin: 0,
    color: COLORS.white,
    fontSize: "16px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#707080",
    fontSize: "24px",
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "300px",
  },
  welcome: {
    color: "#707080",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  message: {
    maxWidth: "80%",
    padding: "12px 16px",
    borderRadius: "12px",
  },
  messageContent: {
    color: COLORS.white,
    fontSize: "13px",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  inputArea: {
    display: "flex",
    gap: "8px",
    padding: "16px",
    borderTop: `1px solid ${COLORS.wallBorder}`,
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    background: "#050509",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "8px",
    color: COLORS.white,
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
  },
  sendBtn: {
    padding: "12px 24px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: "8px",
    color: "#050509",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
  },
};

// ============================================================================
// GitHub README Workflow Components
// ============================================================================

type WorkflowStatus = "pending" | "in_progress" | "completed" | "failed";

interface WorkflowWorklogEntry {
  timestamp: string;
  agent: string;
  action: string;
  note: string;
}

interface GithubReadmeWorkflowResponse {
  taskId: string;
  status: WorkflowStatus;
  summary: string;
  response: string;
  artifacts: Array<{
    type: string;
    content: string;
  }>;
  worklog: WorkflowWorklogEntry[];
}

interface GitHubReadmeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (owner: string, repo: string, token?: string) => void;
  isLoading: boolean;
}

function GitHubReadmeModal({ isOpen, onClose, onSubmit, isLoading }: GitHubReadmeModalProps) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (owner.trim() && repo.trim()) {
      onSubmit(owner.trim(), repo.trim(), token.trim() || undefined);
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>Fetch GitHub README</h3>
          <button style={modalStyles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={modalStyles.form}>
          <div style={modalStyles.inputGroup}>
            <label style={modalStyles.label}>Owner / Organization</label>
            <input
              style={modalStyles.input}
              placeholder="e.g., facebook"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div style={modalStyles.inputGroup}>
            <label style={modalStyles.label}>Repository</label>
            <input
              style={modalStyles.input}
              placeholder="e.g., react"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            type="button"
            style={modalStyles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "▼" : "▶"} Advanced (token)
          </button>

          {showAdvanced && (
            <div style={modalStyles.inputGroup}>
              <label style={modalStyles.label}>GitHub Token (optional)</label>
              <input
                style={modalStyles.input}
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
                disabled={isLoading}
              />
              <span style={modalStyles.hint}>Required for private repos or higher rate limits</span>
            </div>
          )}

          <div style={modalStyles.actions}>
            <button type="button" style={modalStyles.cancelBtn} onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" style={modalStyles.submitBtn} disabled={isLoading || !owner.trim() || !repo.trim()}>
              {isLoading ? "Running..." : "Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// SitRep Modal and Workflow (Different visual style)
// ============================================================================

interface SitRepResponse {
  taskId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  summary: string;
  response: string;
  artifacts: Array<{
    type: string;
    title: string;
    content: string;
  }>;
  worklog: Array<{
    timestamp: string;
    agent: string;
    action: string;
    note: string;
  }>;
  archivedPath?: string;
}

interface SitRepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (scope: string, detailLevel: string) => void;
  isLoading: boolean;
}

function SitRepModal({ isOpen, onClose, onSubmit, isLoading }: SitRepModalProps) {
  const [scope, setScope] = useState("full");
  const [detailLevel, setDetailLevel] = useState("normal");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(scope, detailLevel);
  };

  return (
    <div style={sitrepModalStyles.overlay} onClick={onClose}>
      <div style={sitrepModalStyles.card} onClick={e => e.stopPropagation()}>
        <div style={sitrepModalStyles.header}>
          <div style={sitrepModalStyles.icon}>📋</div>
          <div>
            <h3 style={sitrepModalStyles.title}>Generate Office SitRep</h3>
            <span style={sitrepModalStyles.subtitle}>Create a situation report about the office</span>
          </div>
          <button style={sitrepModalStyles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={sitrepModalStyles.form}>
          <div style={sitrepModalStyles.fieldGroup}>
            <label style={sitrepModalStyles.label}>Report Scope</label>
            <div style={sitrepModalStyles.radioGroup}>
              {["full", "workflows", "agents"].map((val) => (
                <label key={val} style={sitrepModalStyles.radioLabel}>
                  <input
                    type="radio"
                    name="scope"
                    value={val}
                    checked={scope === val}
                    onChange={(e) => setScope(e.target.value)}
                    disabled={isLoading}
                    style={sitrepModalStyles.radio}
                  />
                  <span style={sitrepModalStyles.radioText}>{val.charAt(0).toUpperCase() + val.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={sitrepModalStyles.fieldGroup}>
            <label style={sitrepModalStyles.label}>Detail Level</label>
            <div style={sitrepModalStyles.radioGroup}>
              {["brief", "normal", "deep"].map((val) => (
                <label key={val} style={sitrepModalStyles.radioLabel}>
                  <input
                    type="radio"
                    name="detailLevel"
                    value={val}
                    checked={detailLevel === val}
                    onChange={(e) => setDetailLevel(e.target.value)}
                    disabled={isLoading}
                    style={sitrepModalStyles.radio}
                  />
                  <span style={sitrepModalStyles.radioText}>{val.charAt(0).toUpperCase() + val.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={sitrepModalStyles.actions}>
            <button type="button" style={sitrepModalStyles.cancelBtn} onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" style={sitrepModalStyles.submitBtn} disabled={isLoading}>
              {isLoading ? "Generating..." : "Generate SitRep"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const sitrepModalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)",
    border: "1px solid #3a3a5a",
    borderRadius: "16px",
    padding: "24px",
    width: "440px",
    maxWidth: "90vw",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },
  icon: {
    fontSize: "32px",
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: "20px",
  },
  subtitle: {
    color: "#707090",
    fontSize: "13px",
  },
  closeBtn: {
    marginLeft: "auto",
    background: "transparent",
    border: "none",
    color: "#606070",
    fontSize: "24px",
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    color: "#a0a0b0",
    fontSize: "13px",
    fontWeight: "600",
  },
  radioGroup: {
    display: "flex",
    gap: "12px",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
  },
  radio: {
    accentColor: "#9b59b6",
  },
  radioText: {
    color: "#c0c0d0",
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "8px",
  },
  cancelBtn: {
    padding: "12px 20px",
    background: "transparent",
    border: "1px solid #3a3a5a",
    borderRadius: "8px",
    color: "#a0a0b0",
    fontSize: "14px",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};

interface WorkflowResultPanelProps {
  result: GithubReadmeWorkflowResponse | null;
  onClose?: () => void;
}

function WorkflowResultPanel({ result, onClose }: WorkflowResultPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showWorklog, setShowWorklog] = useState(false);

  if (!result) return null;

  const statusColors: Record<WorkflowStatus, string> = {
    pending: "#feca57",
    in_progress: "#4ecdc4",
    completed: "#26de81",
    failed: "#fc5c65"
  };

  const previewContent = result.artifacts?.[0]?.content || result.response || "";
  const previewLines = previewContent.split("\n").slice(0, 15).join("\n");
  const isTruncated = previewContent.split("\n").length > 15;

  return (
    <div style={resultPanelStyles.container}>
      <div style={resultPanelStyles.header}>
        <span style={{...resultPanelStyles.statusPill, background: statusColors[result.status]}}>
          {result.status}
        </span>
        <span style={resultPanelStyles.summary}>{result.summary}</span>
        {onClose && (
          <button style={resultPanelStyles.closeBtn} onClick={onClose}>×</button>
        )}
      </div>

      <div style={resultPanelStyles.preview}>
        <pre style={resultPanelStyles.previewText}>
          {expanded ? previewContent : previewLines}
          {isTruncated && !expanded && "\n..."}
        </pre>
        {isTruncated && (
          <button style={resultPanelStyles.expandBtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "View full README"}
          </button>
        )}
      </div>

      <div style={resultPanelStyles.worklogSection}>
        <button 
          style={resultPanelStyles.worklogToggle} 
          onClick={() => setShowWorklog(!showWorklog)}
        >
          {showWorklog ? "▼" : "▶"} Workflow timeline ({result.worklog.length} steps)
        </button>
        
        {showWorklog && (
          <div style={resultPanelStyles.worklogList}>
            {result.worklog.map((entry, idx) => (
              <div key={idx} style={resultPanelStyles.worklogEntry}>
                <span style={resultPanelStyles.worklogTime}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span style={resultPanelStyles.worklogAgent}>{entry.agent}</span>
                <span style={resultPanelStyles.worklogAction}>{entry.action}</span>
                <span style={resultPanelStyles.worklogNote}>{entry.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// SitRep workflow display - different visual style (purple theme)
function SitRepWorkflowPanel({ 
  result, 
  onClose,
  isAnimating 
}: { 
  result: SitRepResponse | null;
  onClose?: () => void;
  isAnimating?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showWorklog, setShowWorklog] = useState(false);

  if (!result && !isAnimating) return null;

  if (isAnimating) {
    return (
      <div style={sitrepWorkflowStyles.container}>
        <div style={sitrepWorkflowStyles.scanningHeader}>
          <div style={sitrepWorkflowStyles.scanLine} />
          <span style={sitrepWorkflowStyles.scanningText}>Generating Office SitRep...</span>
        </div>
        <div style={sitrepWorkflowStyles.chain}>
          {["receptionist", "specialist", "executive", "archivist"].map((role, idx) => (
            <div key={role} style={sitrepWorkflowStyles.chainNode}>
              <div style={sitrepWorkflowStyles.nodeIcon}>
                {["📝", "📊", "✅", "📦"][idx]}
              </div>
              <span style={sitrepWorkflowStyles.nodeLabel}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
              {idx < 3 && <div style={sitrepWorkflowStyles.chainConnector} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const statusColors: Record<string, string> = {
    pending: "#feca57",
    in_progress: "#9b59b6",
    completed: "#9b59b6",
    failed: "#e74c3c"
  };

  return (
    <div style={sitrepResultStyles.container}>
      <div style={sitrepResultStyles.header}>
        <span style={{...sitrepResultStyles.statusBadge, background: statusColors[result.status] || "#9b59b6"}}>
          {result.status}
        </span>
        <span style={sitrepResultStyles.title}>Office SitRep</span>
        {onClose && (
          <button style={sitrepResultStyles.closeBtn} onClick={onClose}>×</button>
        )}
      </div>

      {result.archivedPath && (
        <div style={sitrepResultStyles.archiveBadge}>
          📁 Archived: {result.archivedPath}
        </div>
      )}

      <div style={sitrepResultStyles.content}>
        <pre style={sitrepResultStyles.markdown}>
          {expanded ? result.response : result.response.split("\n").slice(0, 20).join("\n")}
          {result.response.split("\n").length > 20 && !expanded && "\n..."}
        </pre>
        {result.response.split("\n").length > 20 && (
          <button style={sitrepResultStyles.expandBtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "Show full report"}
          </button>
        )}
      </div>

      <div style={sitrepResultStyles.worklogSection}>
        <button 
          style={sitrepResultStyles.worklogToggle} 
          onClick={() => setShowWorklog(!showWorklog)}
        >
          {showWorklog ? "▼" : "▶"} Workflow chain ({result.worklog.length} steps)
        </button>
        
        {showWorklog && (
          <div style={sitrepResultStyles.worklogChain}>
            {result.worklog.map((entry, idx) => (
              <div key={idx} style={sitrepResultStyles.chainStep}>
                <div style={sitrepResultStyles.stepDot}>{["📝", "📋", "📊", "✅", "📦"][idx] || "•"}</div>
                <div style={sitrepResultStyles.stepContent}>
                  <span style={sitrepResultStyles.stepAgent}>{entry.agent}</span>
                  <span style={sitrepResultStyles.stepAction}>{entry.action}</span>
                  <span style={sitrepResultStyles.stepNote}>{entry.note}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sitrepWorkflowStyles: Record<string, React.CSSProperties> = {
  container: {
    background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)",
    border: "1px solid #3a3a5a",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "12px",
  },
  scanningHeader: {
    position: "relative",
    height: "30px",
    background: "rgba(155, 89, 182, 0.1)",
    borderRadius: "6px",
    marginBottom: "20px",
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: "-100%",
    width: "100%",
    height: "100%",
    background: "linear-gradient(90deg, transparent, rgba(155, 89, 182, 0.5), transparent)",
    animation: "scan 2s infinite",
  },
  scanningText: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "#9b59b6",
    fontSize: "13px",
    fontWeight: "bold",
  },
  chain: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  chainNode: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  },
  nodeIcon: {
    fontSize: "24px",
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(155, 89, 182, 0.2)",
    borderRadius: "50%",
    border: "2px solid #9b59b6",
  },
  nodeLabel: {
    color: "#a0a0b0",
    fontSize: "11px",
    textTransform: "capitalize",
  },
  chainConnector: {
    width: "30px",
    height: "2px",
    background: "linear-gradient(90deg, #9b59b6, transparent)",
    marginBottom: "20px",
  },
};

const sitrepResultStyles: Record<string, React.CSSProperties> = {
  container: {
    background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)",
    border: "1px solid #3a3a5a",
    borderRadius: "12px",
    padding: "16px",
    marginTop: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  statusBadge: {
    padding: "3px 10px",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "10px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  title: {
    color: "#c0c0d0",
    fontSize: "14px",
    fontWeight: "600",
    flex: 1,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#606070",
    fontSize: "18px",
    cursor: "pointer",
  },
  archiveBadge: {
    background: "rgba(155, 89, 182, 0.15)",
    border: "1px solid rgba(155, 89, 182, 0.3)",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#9b59b6",
    fontSize: "11px",
    marginBottom: "12px",
  },
  content: {
    background: "#0a0a12",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "12px",
    maxHeight: "250px",
    overflow: "auto",
  },
  markdown: {
    margin: 0,
    color: "#b0b0c0",
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  expandBtn: {
    background: "transparent",
    border: "none",
    color: "#9b59b6",
    fontSize: "12px",
    cursor: "pointer",
    marginTop: "8px",
  },
  worklogSection: {
    borderTop: "1px solid #2a2a4a",
    paddingTop: "12px",
  },
  worklogToggle: {
    background: "transparent",
    border: "none",
    color: "#707080",
    fontSize: "12px",
    cursor: "pointer",
  },
  worklogChain: {
    marginTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  chainStep: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  stepDot: {
    fontSize: "14px",
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  stepAgent: {
    color: "#9b59b6",
    fontSize: "11px",
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  stepAction: {
    color: "#a0a0b0",
    fontSize: "10px",
  },
  stepNote: {
    color: "#606070",
    fontSize: "10px",
  },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    background: "#0a0a12",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "12px",
    padding: "24px",
    width: "420px",
    maxWidth: "90vw",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    color: COLORS.white,
    fontSize: "18px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#707080",
    fontSize: "24px",
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    color: "#a0a0b0",
    fontSize: "13px",
  },
  input: {
    padding: "10px 12px",
    background: "#050509",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "6px",
    color: COLORS.white,
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
  },
  hint: {
    color: "#606070",
    fontSize: "11px",
  },
  advancedToggle: {
    background: "transparent",
    border: "none",
    color: "#4ecdc4",
    fontSize: "12px",
    cursor: "pointer",
    textAlign: "left",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "8px",
  },
  cancelBtn: {
    padding: "10px 20px",
    background: "transparent",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "6px",
    color: "#a0a0b0",
    fontSize: "13px",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "10px 24px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: "6px",
    color: "#050509",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};

const resultPanelStyles: Record<string, React.CSSProperties> = {
  container: {
    background: "#0f1520",
    border: `1px solid ${COLORS.wallBorder}`,
    borderRadius: "8px",
    padding: "16px",
    marginTop: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  statusPill: {
    padding: "3px 10px",
    borderRadius: "12px",
    color: "#050509",
    fontSize: "11px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  summary: {
    color: "#a0a0b0",
    fontSize: "13px",
    flex: 1,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#606070",
    fontSize: "18px",
    cursor: "pointer",
  },
  preview: {
    background: "#050509",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "12px",
    maxHeight: "200px",
    overflow: "auto",
  },
  previewText: {
    margin: 0,
    color: "#c0c0d0",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  expandBtn: {
    background: "transparent",
    border: "none",
    color: "#4ecdc4",
    fontSize: "12px",
    cursor: "pointer",
    marginTop: "8px",
  },
  worklogSection: {
    borderTop: `1px solid ${COLORS.wallBorder}`,
    paddingTop: "12px",
  },
  worklogToggle: {
    background: "transparent",
    border: "none",
    color: "#707080",
    fontSize: "12px",
    cursor: "pointer",
  },
  worklogList: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  worklogEntry: {
    display: "flex",
    gap: "8px",
    fontSize: "11px",
    alignItems: "center",
  },
  worklogTime: {
    color: "#505060",
    minWidth: "70px",
  },
  worklogAgent: {
    color: "#4ecdc4",
    minWidth: "80px",
    fontWeight: "bold",
  },
  worklogAction: {
    color: "#a0a0b0",
    minWidth: "100px",
  },
  worklogNote: {
    color: "#707080",
    flex: 1,
  },
};


