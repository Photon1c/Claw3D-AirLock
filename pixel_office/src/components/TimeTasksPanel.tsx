import { useEffect, useState } from "react";

const API_BASE = "";

const STATUS_LABELS: Record<string, string> = {
  inbox: "Inbox",
  ready: "Ready",
  "in-progress": "In Progress",
  blocked: "Blocked",
  done: "Done",
  dropped: "Dropped",
};

const STATUS_COLORS: Record<string, string> = {
  inbox: "#888",
  ready: "#4ecdc4",
  "in-progress": "#feca57",
  blocked: "#ff6b6b",
  done: "#26de81",
  dropped: "#666",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "#ff4b4b",
  P1: "#feca57",
  P2: "#4ecdc4",
};

const PRIORITY_OPTIONS = ["P0", "P1", "P2"];

const TYPE_COLORS: Record<string, string> = {
  work: "#4ecdc4",
  hobby: "#a55eea",
  admin: "#feca57",
  "self-care": "#ff9ff3",
  social: "#54a0ff",
  health: "#26de81",
};

const AGENTS = [
  { id: "frontdesk", name: "FrontDesk" },
  { id: "ironclaw", name: "IronClaw" },
  { id: "zeroclaw", name: "ZeroClaw" },
  { id: "leslieclaw", name: "LeslieClaw" },
  { id: "openclaw", name: "OpenClaw" },
  { id: "hermitclaw", name: "HermitClaw" },
  { id: "sherlobster", name: "Sherlobster" },
];

interface TaskV2 {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  timebox: string | null;
  due: string | null;
  tags: string[];
  source: string;
  links: any[];
}

interface CalendarEvent {
  id: number;
  title: string;
  type: string;
  start_time: string;
  end_time: string;
  source: string;
  notes: string | null;
  links: any[];
}

interface Session {
  id: number;
  task_id: number | null;
  start_time: string;
  end_time: string | null;
  notes: string | null;
}

interface TodayPlan {
  date: string;
  work: { events: CalendarEvent[]; tasks: TaskV2[] };
  personal: { events: CalendarEvent[]; tasks: TaskV2[] };
  chapters: string[];
}

interface TodayLog {
  date: string;
  sessions: Session[];
  completedTasks: TaskV2[];
  blockedTasks: TaskV2[];
  narrative: string;
}

interface ActiveSession {
  id: number;
  task_id: number | null;
  start_time: string;
}

interface TimeTasksPanelProps {
  onClose: () => void;
}

export default function TimeTasksPanel({ onClose }: TimeTasksPanelProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "events" | "plan" | "log">("tasks");
  const [tasks, setTasks] = useState<TaskV2[]>([]);
  const [eventsList, setEventsList] = useState<CalendarEvent[]>([]);
  const [todaysPlan, setTodaysPlan] = useState<TodayPlan | null>(null);
  const [todaysLog, setTodaysLog] = useState<TodayLog | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTags, setNewTaskTags] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("P2");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventType, setNewEventType] = useState<string>("work");
  const [error, setError] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskAssignee, setTaskAssignee] = useState<Record<number, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, eventsRes, planRes, logRes, sessionRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks-v2`).catch(() => ({ ok: false, json: async () => ({ tasks: [] }) })),
        fetch(`${API_BASE}/api/events/today`).catch(() => ({ ok: false, json: async () => ({ events: [] }) })),
        fetch(`${API_BASE}/api/time-tasks/plan`).catch(() => ({ ok: false, json: async () => null })),
        fetch(`${API_BASE}/api/time-tasks/log`).catch(() => ({ ok: false, json: async () => null })),
        fetch(`${API_BASE}/api/sessions/active`).catch(() => ({ ok: false, json: async () => null })),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEventsList(data.events || []);
      }
      if (planRes.ok) {
        const data = await planRes.json();
        setTodaysPlan(data);
      }
      if (logRes.ok) {
        const data = await logRes.json();
        setTodaysLog(data);
      }
      if (sessionRes.ok) {
        const data = await sessionRes.json();
        setActiveSession(data.session);
      }
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError(err.message || "Failed to load data");
    }
    setLoading(false);
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    try {
      const tags = newTaskTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/api/tasks-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          tags,
          status: "inbox",
          priority: newTaskPriority,
        }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks([task, ...tasks]);
        setNewTaskTitle("");
        setNewTaskTags("");
        setNewTaskPriority("P2");
      }
    } catch (err: any) {
      console.error("Failed to create task:", err);
    }
  }

  async function handleDeleteTask(id: number) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks-v2/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (err: any) {
      console.error("Failed to delete task:", err);
    }
  }

  async function handleAssignTask(taskId: number, assigneeId: string) {
    setTaskAssignee(prev => ({ ...prev, [taskId]: assigneeId }));
    setEditingTaskId(null);
  }

  async function handleUpdateTaskStatus(id: number, status: string) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks-v2/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === id ? updated : t));
      }
    } catch (err: any) {
      console.error("Failed to update task:", err);
    }
  }

  async function handleStartSession(taskId: number) {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        await handleUpdateTaskStatus(taskId, "in-progress");
      }
    } catch (err: any) {
      console.error("Failed to start session:", err);
    }
  }

  async function handleEndSession(notes: string = "") {
    if (!activeSession) return;
    try {
      await fetch(`${API_BASE}/api/sessions/${activeSession.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (activeSession.task_id) {
        await handleUpdateTaskStatus(activeSession.task_id, "done");
      }
      setActiveSession(null);
      await loadData();
    } catch (err: any) {
      console.error("Failed to end session:", err);
    }
  }

  async function handleAddEvent() {
    if (!newEventTitle.trim()) return;
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      const res = await fetch(`${API_BASE}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEventTitle.trim(),
          type: newEventType,
          start_time: now.toISOString(),
          end_time: end.toISOString(),
        }),
      });
      if (res.ok) {
        const event = await res.json();
        setEventsList([...eventsList, event]);
        setNewEventTitle("");
      }
    } catch (err: any) {
      console.error("Failed to create event:", err);
    }
  }

  const filteredTasks = filter === "all" 
    ? tasks 
    : tasks.filter(t => t.status === filter);

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Time + Tasks</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Time + Tasks</h3>
        <button style={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tabs}>
        {["tasks", "events", "plan", "log"].map(tab => (
          <button
            key={tab}
            style={{...styles.tab, ...(activeTab === tab ? styles.tabActive : {})}}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeSession && (
        <div style={styles.activeSessionBanner}>
          <span>Session active: Task #{activeSession.task_id}</span>
          <button style={styles.endSessionBtn} onClick={() => handleEndSession("")}>
            End Session
          </button>
        </div>
      )}

      {activeTab === "tasks" && (
        <div style={styles.content}>
          <div style={styles.addForm}>
            <input
              style={styles.input}
              placeholder="New task title..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddTask()}
            />
            <input
              style={{...styles.input, width: "100px"}}
              placeholder="Tags"
              value={newTaskTags}
              onChange={e => setNewTaskTags(e.target.value)}
            />
            <select
              style={styles.prioritySelect}
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(e.target.value)}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button style={styles.addBtn} onClick={handleAddTask}>+</button>
          </div>

          <div style={styles.filters}>
            <button
              style={{...styles.filterBtn, ...(filter === "all" ? styles.filterActive : {})}}
              onClick={() => setFilter("all")}
            >
              All ({tasks.length})
            </button>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <button
                key={status}
                style={{...styles.filterBtn, ...(filter === status ? styles.filterActive : {})}}
                onClick={() => setFilter(status)}
              >
                {label} ({statusCounts[status] || 0})
              </button>
            ))}
          </div>

          <div style={styles.list}>
            {filteredTasks.map(task => (
              <div 
                key={task.id} 
                style={{
                  ...styles.taskItem,
                  ...(hoveredTaskId === task.id ? styles.taskItemHover : {}),
                }}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <button
                  style={{...styles.statusBtn, background: STATUS_COLORS[task.status] || "#888"}}
                  onClick={() => {
                    const nextStatus = {
                      inbox: "ready",
                      ready: "in-progress",
                      "in-progress": "done",
                      blocked: "ready",
                      done: "inbox",
                      dropped: "inbox",
                    }[task.status];
                    if (nextStatus) handleUpdateTaskStatus(task.id, nextStatus);
                  }}
                  title={`Status: ${task.status} (click to advance)`}
                >
                  {STATUS_LABELS[task.status]?.charAt(0) || "?"}
                </button>
                <div style={styles.taskContent}>
                  <span style={{
                    ...styles.taskTitle,
                    ...(task.status === "done" ? styles.taskTitleDone : {}),
                  }}>{task.title}</span>
                  <div style={styles.taskMeta}>
                    <span style={{...styles.priorityBadge, background: PRIORITY_COLORS[task.priority]}}>
                      {task.priority}
                    </span>
                    {task.timebox && (
                      <span style={styles.timebox}>{task.timebox}</span>
                    )}
                    {task.tags?.map((tag: string) => (
                      <span key={tag} style={styles.tag}>{tag}</span>
                    ))}
                    {taskAssignee[task.id] && (
                      <span style={styles.assigneeBadge}>
                        → {AGENTS.find(a => a.id === taskAssignee[task.id])?.name || taskAssignee[task.id]}
                      </span>
                    )}
                  </div>
                </div>
                <div style={styles.taskActions}>
                  {editingTaskId === task.id ? (
                    <select
                      style={styles.assignSelect}
                      value={taskAssignee[task.id] || ""}
                      onChange={e => handleAssignTask(task.id, e.target.value)}
                      onBlur={() => setEditingTaskId(null)}
                      autoFocus
                    >
                      <option value="">Unassigned</option>
                      {AGENTS.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {!activeSession && task.status !== "done" && task.status !== "dropped" && (
                        <button
                          style={styles.sessionBtn}
                          onClick={() => handleStartSession(task.id)}
                          title="Start session"
                        >
                          ▶
                        </button>
                      )}
                      <button
                        style={styles.assignBtn}
                        onClick={() => setEditingTaskId(task.id)}
                        title="Assign to agent"
                      >
                        👤
                      </button>
                      {hoveredTaskId === task.id && (
                        <button
                          style={styles.deleteBtn}
                          onClick={() => handleDeleteTask(task.id)}
                          title="Delete task"
                        >
                          ×
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <div style={styles.empty}>No tasks found</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "events" && (
        <div style={styles.content}>
          <div style={styles.addForm}>
            <input
              style={styles.input}
              placeholder="New event title..."
              value={newEventTitle}
              onChange={e => setNewEventTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddEvent()}
            />
            <select
              style={styles.select}
              value={newEventType}
              onChange={e => setNewEventType(e.target.value)}
            >
              {Object.keys(TYPE_COLORS).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button style={styles.addBtn} onClick={handleAddEvent}>+</button>
          </div>

          <div style={styles.list}>
            {eventsList.map(event => (
              <div key={event.id} style={styles.eventItem}>
                <span style={{...styles.eventType, background: TYPE_COLORS[event.type] || "#888"}}>
                  {event.type}
                </span>
                <div style={styles.eventContent}>
                  <span style={styles.eventTitle}>{event.title}</span>
                  <span style={styles.eventTime}>
                    {new Date(event.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - 
                    {new Date(event.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            {eventsList.length === 0 && (
              <div style={styles.empty}>No events for today</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "plan" && todaysPlan && (
        <div style={styles.content}>
          <h4 style={styles.sectionTitle}>Today's Chapters</h4>
          <div style={styles.chapters}>
            {todaysPlan.chapters.map((chapter: string) => (
              <span key={chapter} style={styles.chapterBadge}>{chapter}</span>
            ))}
          </div>

          {todaysPlan.work?.tasks?.length > 0 && (
            <>
              <h4 style={styles.sectionTitle}>Work Tasks</h4>
              {todaysPlan.work.tasks.map((task: TaskV2) => (
                <div key={task.id} style={styles.planItem}>
                  <span style={styles.planTitle}>{task.title}</span>
                  <span style={{...styles.priorityBadge, background: PRIORITY_COLORS[task.priority]}}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </>
          )}

          {todaysPlan.personal?.tasks?.length > 0 && (
            <>
              <h4 style={styles.sectionTitle}>Personal Tasks</h4>
              {todaysPlan.personal.tasks.map((task: TaskV2) => (
                <div key={task.id} style={styles.planItem}>
                  <span style={styles.planTitle}>{task.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === "log" && todaysLog && (
        <div style={styles.content}>
          <div style={styles.narrative}>
            <h4 style={styles.sectionTitle}>Today's Narrative</h4>
            <p style={styles.narrativeText}>{todaysLog.narrative}</p>
          </div>

          <h4 style={styles.sectionTitle}>Sessions ({todaysLog.sessions?.length || 0})</h4>
          {todaysLog.sessions?.map((session: Session) => (
            <div key={session.id} style={styles.sessionItem}>
              <span style={styles.sessionTime}>
                {new Date(session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={styles.sessionNotes}>
                {session.notes || (session.end_time ? "Session completed" : "In progress...")}
              </span>
            </div>
          ))}
          {(!todaysLog.sessions || todaysLog.sessions.length === 0) && (
            <div style={styles.empty}>No sessions today</div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    right: 0,
    top: 0,
    bottom: 0,
    width: 360,
    background: "#0a0a12",
    borderLeft: "1px solid #1a1a2e",
    display: "flex",
    flexDirection: "column",
    zIndex: 1000,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #1a1a2e",
  },
  title: {
    margin: 0,
    fontSize: 14,
    color: "#fff",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 20,
    cursor: "pointer",
    padding: "0 4px",
  },
  loading: {
    padding: 20,
    textAlign: "center",
    color: "#888",
  },
  error: {
    padding: "8px 16px",
    background: "#3d1f1f",
    color: "#ff6b6b",
    fontSize: 12,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #1a1a2e",
  },
  tab: {
    flex: 1,
    padding: "8px 4px",
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
  },
  tabActive: {
    color: "#4ecdc4",
    borderBottom: "2px solid #4ecdc4",
  },
  activeSessionBanner: {
    padding: "8px 16px",
    background: "#1a2a2a",
    color: "#feca57",
    fontSize: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  endSessionBtn: {
    padding: "4px 8px",
    background: "#ff6b6b",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    cursor: "pointer",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: 12,
  },
  addForm: {
    display: "flex",
    gap: 6,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: 80,
    padding: "6px 8px",
    background: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
  },
  select: {
    padding: "6px 8px",
    background: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
  },
  prioritySelect: {
    padding: "6px 8px",
    background: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    width: 50,
  },
  addBtn: {
    padding: "6px 12px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: 4,
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 14,
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 12,
  },
  filterBtn: {
    padding: "4px 8px",
    background: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 4,
    color: "#888",
    fontSize: 11,
    cursor: "pointer",
  },
  filterActive: {
    background: "#2a2a3e",
    color: "#4ecdc4",
    borderColor: "#4ecdc4",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  taskItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
    border: "1px solid transparent",
    transition: "all 0.15s ease",
  },
  taskItemHover: {
    background: "#222233",
    border: "1px solid #3a3a5a",
  },
  statusBtn: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 4,
    color: "#000",
    fontWeight: "bold",
    fontSize: 11,
    cursor: "pointer",
    flexShrink: 0,
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    display: "block",
    color: "#fff",
    fontSize: 13,
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  taskTitleDone: {
    textDecoration: "line-through",
    opacity: 0.6,
  },
  taskMeta: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
    alignItems: "center",
  },
  priorityBadge: {
    padding: "2px 6px",
    borderRadius: 3,
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
  },
  timebox: {
    padding: "2px 6px",
    background: "#2a2a3e",
    borderRadius: 3,
    color: "#888",
    fontSize: 10,
  },
  tag: {
    padding: "2px 6px",
    background: "#2a2a3e",
    borderRadius: 3,
    color: "#aaa",
    fontSize: 10,
  },
  assigneeBadge: {
    padding: "2px 6px",
    background: "#4a4a6a",
    borderRadius: 3,
    color: "#4ecdc4",
    fontSize: 10,
  },
  taskActions: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    flexShrink: 0,
  },
  sessionBtn: {
    padding: "4px 8px",
    background: "#4ecdc4",
    border: "none",
    borderRadius: 4,
    color: "#000",
    cursor: "pointer",
    fontSize: 10,
  },
  assignBtn: {
    padding: "4px 8px",
    background: "#2a2a3e",
    border: "none",
    borderRadius: 4,
    color: "#888",
    cursor: "pointer",
    fontSize: 12,
    opacity: 0.7,
  },
  assignSelect: {
    padding: "4px 6px",
    background: "#1a1a2e",
    border: "1px solid #4ecdc4",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    maxWidth: 100,
  },
  deleteBtn: {
    padding: "4px 8px",
    background: "transparent",
    border: "1px solid #ff6b6b",
    borderRadius: 4,
    color: "#ff6b6b",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    opacity: 0.8,
  },
  eventItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
  },
  eventType: {
    padding: "4px 8px",
    borderRadius: 4,
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    display: "block",
    color: "#fff",
    fontSize: 13,
  },
  eventTime: {
    color: "#888",
    fontSize: 11,
  },
  sectionTitle: {
    margin: "16px 0 8px",
    color: "#888",
    fontSize: 11,
    textTransform: "uppercase",
  },
  chapters: {
    display: "flex",
    gap: 8,
  },
  chapterBadge: {
    padding: "4px 12px",
    background: "#4ecdc4",
    borderRadius: 12,
    color: "#000",
    fontSize: 12,
    fontWeight: "bold",
  },
  planItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
    marginBottom: 4,
  },
  planTitle: {
    color: "#fff",
    fontSize: 13,
  },
  narrative: {
    marginBottom: 16,
  },
  narrativeText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
  },
  sessionItem: {
    display: "flex",
    gap: 8,
    padding: 8,
    background: "#1a1a2e",
    borderRadius: 6,
    marginBottom: 4,
  },
  sessionTime: {
    color: "#4ecdc4",
    fontSize: 12,
    minWidth: 50,
  },
  sessionNotes: {
    color: "#aaa",
    fontSize: 12,
    flex: 1,
  },
  empty: {
    padding: 20,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  },
};
