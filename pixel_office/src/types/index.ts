export type AgentStatus = "working" | "idle";
export type AgentVisibility = "public" | "private" | "offline";
export type ViewMode = "public" | "operator";
export type TaskStatus =
  | "queued"
  | "in_progress"
  | "awaiting_review"
  | "approved"
  | "escalated"
  | "ready_for_delivery"
  | "completed"
  | "archived"
  | "failed"
  | "todo"
  | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent" | "medium";

export type AgentMood = "happy" | "neutral" | "thinking" | "excited" | "tired" | "frustrated";

export type AgentRole =
  | "receptionist"
  | "clerk"
  | "executive"
  | "specialist"
  | "custodian"
  | "archivist";

export interface ZoneActivity {
  zoneId: string;
  agentCount: number;
  busyLevel: "quiet" | "moderate" | "busy";
  lastActivity: number;
  conversationActive: boolean;
}

export interface ConversationContext {
  location: string;
  mood: string;
  intensity: "high" | "medium" | "low";
  participants: string[];
}

export interface TaskWorkLog {
  timestamp: string;
  agent: string;
  action: string;
  note: string;
}

export interface Task {
  id: string;
  workflowType?: string;
  createdAt: string | number;
  createdBy?: string;
  requester?: string;
  status: TaskStatus;
  priority: TaskPriority;
  currentOwner?: string;
  recommendedNextOwner?: string;
  requiresReview?: boolean;
  requiresExecutive?: boolean;
  summary?: string;
  inputs?: Record<string, any>;
  worklog?: TaskWorkLog[];
  artifacts?: any[];
  decision?: any;
  response?: any;
  archive?: {
    logRequired: boolean;
    recordClass: string;
  };
  title?: string;
  description?: string;
  assigneeId?: string;
}

export interface Agent {
  id: string;
  name: string;
  color: string;
  role: AgentRole;
  status: AgentStatus;
  visibility?: AgentVisibility;
  mood: AgentMood;
  thoughtBubble?: {
    text: string;
    expiresAt: number;
  };
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  dir: "left" | "right";
  frame: 0 | 1;
  mode: "walking" | "sitting" | "idle-wander";
  deskIndex: number;
  currentZone?: string;
}

export interface EmployeeStatusResponse {
  employees: Array<{
    id: string;
    status: AgentStatus;
    visibility?: AgentVisibility;
  }>;
}

export interface DashboardConfig {
  pollingInterval: number;
  mockMode: boolean;
  mockToggleSpeed: number;
  showStatusBar: boolean;
  showNames: boolean;
  animationSpeed: number;
  theme: "dark" | "light";
  canvasScale: number;
  liveMode: boolean;
  viewMode: ViewMode;
}

export type PredictionType = "price" | "percentage_return" | "direction";
export type PredictedDirection = "up" | "down" | "flat";
export type ForecastStatus = "pending" | "evaluated" | "invalid";

export interface StockTicker {
  id: number;
  symbol: string;
  exchange: string | null;
  name: string | null;
  created_at: string;
}

export interface StockForecast {
  id: number;
  user_id: number;
  ticker_id: number;
  created_at: string;
  horizon_days: number;
  target_date: string;
  prediction_type: PredictionType;
  predicted_price: number | null;
  predicted_return_pct: number | null;
  predicted_direction: PredictedDirection | null;
  baseline_price: number | null;
  notes: string | null;
  status: ForecastStatus;
  evaluated_at: string | null;
  actual_price: number | null;
  actual_return_pct: number | null;
  absolute_error_price: number | null;
  absolute_error_pct: number | null;
  ticker_symbol?: string;
}

export interface CreateForecastRequest {
  symbol: string;
  horizon_days?: number;
  target_date?: string;
  prediction_type: PredictionType;
  predicted_price?: number;
  predicted_direction?: PredictedDirection;
  notes?: string;
}

export interface CreateForecastResponse {
  forecast: StockForecast;
}

export interface ListForecastsResponse {
  forecasts: StockForecast[];
  total: number;
}

export interface EvaluateForecastsResponse {
  evaluatedCount: number;
  errors: string[];
}

export interface ForecastAccuracyStats {
  totalForecasts: number;
  evaluatedCount: number;
  meanAbsoluteErrorPrice: number | null;
  meanAbsoluteErrorPct: number | null;
  directionHitRate: number | null;
}

export type EventType = "work" | "hobby" | "admin" | "self-care" | "social" | "health";

export interface CalendarEvent {
  id: number;
  title: string;
  type: EventType;
  start_time: Date;
  end_time: Date;
  source: string;
  notes: string | null;
  links: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateEventInput {
  title: string;
  type: EventType;
  start_time: Date;
  end_time: Date;
  source?: string;
  notes?: string;
  links?: string[];
}

export type TaskV2Status = "inbox" | "ready" | "in-progress" | "blocked" | "done" | "dropped";
export type TaskV2Priority = "P0" | "P1" | "P2";

export interface TaskV2 {
  id: number;
  title: string;
  description: string | null;
  status: TaskV2Status;
  priority: TaskV2Priority;
  timebox: string | null;
  due: Date | null;
  tags: string[];
  source: string;
  links: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskV2Input {
  title: string;
  description?: string;
  status?: TaskV2Status;
  priority?: TaskV2Priority;
  timebox?: string;
  due?: Date;
  tags?: string[];
  source?: string;
  links?: string[];
}

export interface Session {
  id: number;
  task_id: number | null;
  start_time: Date;
  end_time: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSessionInput {
  task_id?: number;
  start_time?: Date;
  end_time?: Date;
  notes?: string;
}

export interface TodayPlan {
  date: string;
  work: { events: CalendarEvent[]; tasks: TaskV2[] };
  personal: { events: CalendarEvent[]; tasks: TaskV2[] };
  chapters: string[];
}

export interface TodayLog {
  date: string;
  sessions: Session[];
  completedTasks: TaskV2[];
  blockedTasks: TaskV2[];
  narrative: string;
}

export interface MicroSprint {
  availableMinutes: number;
  suggestedTasks: TaskV2[];
  calendarBlocks: CalendarEvent[];
}
