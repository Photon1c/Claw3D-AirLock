import { getPool, getConfig } from "./config.js";

export interface Entity {
  id: number;
  type: string;
  name: string;
  slug: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEntityInput {
  type: string;
  name: string;
  slug?: string;
  metadata?: any;
}

export interface ListEntitiesInput {
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MemEntry {
  id: number;
  entity_id: number | null;
  kind: string;
  title: string | null;
  content: string;
  tags: any;
  timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMemEntryInput {
  entityId?: number;
  kind: string;
  title?: string;
  content: string;
  tags?: any;
  timestamp?: Date;
}

export interface ListMemEntriesInput {
  entityId?: number;
  kind?: string;
  tags?: any;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface Pref {
  id: number;
  scope: string;
  key: string;
  value: any;
  created_at: Date;
  updated_at: Date;
}

export interface PixelState {
  id: number;
  owner: string;
  key: string;
  value: any;
  created_at: Date;
  updated_at: Date;
}

function parseValue(value: any, isJson: boolean): any {
  if (value === null || value === undefined) return null;
  if (isJson && typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function toMySQLPlaceholders(sql: string): string {
  return sql.replace(/\$[0-9]+/g, "?");
}

function stripReturning(sql: string): string {
  return sql.replace(/\s+RETURNING\s+\*\s*$/gim, "");
}

async function runInsert(sql: string, params: any[] = []): Promise<{ rows: any[]; insertId?: number }> {
  const pool = await getPool();
  const config = getConfig();
  const isPg = config.db.type === "postgres";

  if (!isPg) {
    sql = toMySQLPlaceholders(sql);
    sql = stripReturning(sql);
  }

  if (isPg) {
    const result = await (pool as any).query(sql, params);
    return { rows: result.rows };
  } else {
    const [result] = await (pool as any).query(sql, params);
    return { rows: [], insertId: result.insertId };
  }
}

async function runQuery(sql: string, params: any[] = []): Promise<any[]> {
  const pool = await getPool();
  const config = getConfig();
  const isPg = config.db.type === "postgres";

  if (!isPg) {
    sql = toMySQLPlaceholders(sql);
    sql = stripReturning(sql);
  }

  if (isPg) {
    const result = await (pool as any).query(sql, params);
    return result.rows;
  } else {
    const [rows] = await (pool as any).query(sql, params);
    return rows;
  }
}

export const entities = {
  async create(input: CreateEntityInput): Promise<Entity> {
    const sql = `
      INSERT INTO entities (type, name, slug, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const rows = await runQuery(sql, [input.type, input.name, input.slug || null, metadata]);
    const row = rows[0];
    return {
      ...row,
      metadata: parseValue(row.metadata, true),
    };
  },

  async getById(id: number): Promise<Entity | null> {
    const rows = await runQuery("SELECT * FROM entities WHERE id = $1", [id]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      metadata: parseValue(row.metadata, true),
    };
  },

  async getBySlug(slug: string): Promise<Entity | null> {
    const rows = await runQuery("SELECT * FROM entities WHERE slug = $1", [slug]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      metadata: parseValue(row.metadata, true),
    };
  },

  async list(input: ListEntitiesInput = {}): Promise<Entity[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(input.type);
    }
    if (input.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR type ILIKE $${paramIndex})`);
      params.push(`%${input.search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const sql = `
      SELECT * FROM entities ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await runQuery(sql, params);
    return rows.map((row: any) => ({
      ...row,
      metadata: parseValue(row.metadata, true),
    }));
  },

  async update(id: number, input: Partial<CreateEntityInput>): Promise<Entity | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(input.slug || null);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(input.metadata ? JSON.stringify(input.metadata) : null);
    }

    if (updates.length === 0) return this.getById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE entities SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const rows = await runQuery(sql, params);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      metadata: parseValue(row.metadata, true),
    };
  },
};

export const memEntries = {
  async create(input: CreateMemEntryInput): Promise<MemEntry> {
    const sql = `
      INSERT INTO mem_entries (entity_id, kind, title, content, tags, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const tags = input.tags ? JSON.stringify(input.tags) : null;
    const rows = await runQuery(sql, [
      input.entityId || null,
      input.kind,
      input.title || null,
      input.content,
      tags,
      input.timestamp || new Date(),
    ]);
    const row = rows[0];
    return {
      ...row,
      tags: parseValue(row.tags, true),
    };
  },

  async getById(id: number): Promise<MemEntry | null> {
    const rows = await runQuery("SELECT * FROM mem_entries WHERE id = $1", [id]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      tags: parseValue(row.tags, true),
    };
  },

  async list(input: ListMemEntriesInput = {}): Promise<MemEntry[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.entityId !== undefined) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(input.entityId);
    }
    if (input.kind) {
      conditions.push(`kind = $${paramIndex++}`);
      params.push(input.kind);
    }
    if (input.since) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(input.since);
    }
    if (input.until) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(input.until);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const sql = `
      SELECT * FROM mem_entries ${where}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await runQuery(sql, params);
    return rows.map((row: any) => ({
      ...row,
      tags: parseValue(row.tags, true),
    }));
  },

  async update(id: number, input: Partial<{ title: string; content: string; tags: any; timestamp: Date }>): Promise<MemEntry | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(input.title);
    }
    if (input.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(input.content);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(input.tags ? JSON.stringify(input.tags) : null);
    }
    if (input.timestamp !== undefined) {
      updates.push(`timestamp = $${paramIndex++}`);
      params.push(input.timestamp);
    }

    if (updates.length === 0) return this.getById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE mem_entries SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const rows = await runQuery(sql, params);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      tags: parseValue(row.tags, true),
    };
  },
};

export const prefs = {
  async get(scope: string, key: string): Promise<any> {
    const rows = await runQuery(
      "SELECT value FROM prefs WHERE scope = $1 AND key = $2",
      [scope, key]
    );
    if (!rows[0]) return null;
    return parseValue(rows[0].value, true);
  },

  async set(scope: string, key: string, value: any): Promise<void> {
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    await runQuery(
      `INSERT INTO prefs (scope, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (scope, key) DO UPDATE SET value = $3, updated_at = NOW()`,
      [scope, key, valueStr]
    );
  },

  async list(scope: string): Promise<Record<string, any>> {
    const rows = await runQuery(
      "SELECT key, value FROM prefs WHERE scope = $1",
      [scope]
    );
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = parseValue(row.value, true);
    }
    return result;
  },
};

export const pixelState = {
  async get(owner: string, key: string): Promise<any> {
    const rows = await runQuery(
      "SELECT value FROM pixel_state WHERE owner = $1 AND key = $2",
      [owner, key]
    );
    if (!rows[0]) return null;
    return parseValue(rows[0].value, true);
  },

  async set(owner: string, key: string, value: any): Promise<void> {
    const valueJson = JSON.stringify(value);
    await runQuery(
      `INSERT INTO pixel_state (owner, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (owner, key) DO UPDATE SET value = $3, updated_at = NOW()`,
      [owner, key, valueJson]
    );
  },

  async list(owner: string): Promise<Record<string, any>> {
    const rows = await runQuery(
      "SELECT key, value FROM pixel_state WHERE owner = $1",
      [owner]
    );
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = parseValue(row.value, true);
    }
    return result;
  },
};

export interface Event {
  id: number;
  title: string;
  type: string;
  start_time: Date;
  end_time: Date;
  source: string;
  notes: string | null;
  links: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEventInput {
  title: string;
  type: string;
  start_time: Date;
  end_time: Date;
  source?: string;
  notes?: string;
  links?: string[];
}

export const events = {
  async create(input: CreateEventInput): Promise<Event> {
    const sql = `
      INSERT INTO events (title, type, start_time, end_time, source, notes, links)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const links = input.links ? JSON.stringify(input.links) : "[]";
    const result = await runInsert(sql, [
      input.title,
      input.type,
      input.start_time,
      input.end_time,
      input.source || "manual",
      input.notes || null,
      links,
    ]);
    if (result.rows[0]) {
      const row = result.rows[0];
      return {
        ...row,
        links: parseValue(row.links, true),
      };
    }
    const fetched = await events.getById(result.insertId!);
    if (!fetched) throw new Error("Failed to create event");
    return fetched;
  },

  async getById(id: number): Promise<Event | null> {
    const rows = await runQuery("SELECT * FROM events WHERE id = $1", [id]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      links: parseValue(row.links, true),
    };
  },

  async listByDay(date: Date): Promise<Event[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sql = `
      SELECT * FROM events
      WHERE start_time >= $1 AND start_time <= $2
      ORDER BY start_time ASC
    `;
    const rows = await runQuery(sql, [startOfDay, endOfDay]);
    return rows.map((row: any) => ({
      ...row,
      links: parseValue(row.links, true),
    }));
  },

  async listByWeek(weekStartDate: Date): Promise<Event[]> {
    const start = new Date(weekStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const sql = `
      SELECT * FROM events
      WHERE start_time >= $1 AND start_time < $2
      ORDER BY start_time ASC
    `;
    const rows = await runQuery(sql, [start, end]);
    return rows.map((row: any) => ({
      ...row,
      links: parseValue(row.links, true),
    }));
  },

  async update(id: number, input: Partial<CreateEventInput>): Promise<Event | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(input.title);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(input.type);
    }
    if (input.start_time !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      params.push(input.start_time);
    }
    if (input.end_time !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(input.end_time);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(input.notes || null);
    }
    if (input.links !== undefined) {
      updates.push(`links = $${paramIndex++}`);
      params.push(JSON.stringify(input.links));
    }

    if (updates.length === 0) return this.getById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE events SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const rows = await runQuery(sql, params);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      links: parseValue(row.links, true),
    };
  },

  async delete(id: number): Promise<boolean> {
    const sql = "DELETE FROM events WHERE id = $1";
    await runQuery(sql, [id]);
    return true;
  },
};

export interface TaskV2 {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  timebox: string | null;
  due: Date | null;
  tags: any;
  source: string;
  links: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskV2Input {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  timebox?: string;
  due?: Date;
  tags?: string[];
  source?: string;
  links?: string[];
}

export interface ListTasksV2Input {
  status?: string;
  priority?: string;
  tags?: string[];
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export const tasksV2 = {
  async create(input: CreateTaskV2Input): Promise<TaskV2> {
    const sql = `
      INSERT INTO tasks_v2 (title, description, status, priority, timebox, due, tags, source, links)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const tags = input.tags ? JSON.stringify(input.tags) : "[]";
    const links = input.links ? JSON.stringify(input.links) : "[]";
    const result = await runInsert(sql, [
      input.title,
      input.description || null,
      input.status || "inbox",
      input.priority || "P2",
      input.timebox || null,
      input.due || null,
      tags,
      input.source || "manual",
      links,
    ]);
    if (result.rows[0]) {
      const row = result.rows[0];
      return {
        ...row,
        tags: parseValue(row.tags, true),
        links: parseValue(row.links, true),
      };
    }
    const fetched = await tasksV2.getById(result.insertId!);
    if (!fetched) throw new Error("Failed to create task");
    return fetched;
  },

  async getById(id: number): Promise<TaskV2 | null> {
    const rows = await runQuery("SELECT * FROM tasks_v2 WHERE id = $1", [id]);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      tags: parseValue(row.tags, true),
      links: parseValue(row.links, true),
    };
  },

  async list(input: ListTasksV2Input = {}): Promise<TaskV2[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }
    if (input.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(input.priority);
    }
    if (input.since) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(input.since);
    }
    if (input.until) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(input.until);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const sql = `
      SELECT * FROM tasks_v2 ${where}
      ORDER BY 
        CASE priority WHEN 'P0' THEN 1 WHEN 'P1' THEN 2 WHEN 'P2' THEN 3 END,
        due IS NOT NULL DESC, due ASC,
        created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await runQuery(sql, params);
    return rows.map((row: any) => ({
      ...row,
      tags: parseValue(row.tags, true),
      links: parseValue(row.links, true),
    }));
  },

  async update(id: number, input: Partial<CreateTaskV2Input>): Promise<TaskV2 | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description || null);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(input.priority);
    }
    if (input.timebox !== undefined) {
      updates.push(`timebox = $${paramIndex++}`);
      params.push(input.timebox || null);
    }
    if (input.due !== undefined) {
      updates.push(`due = $${paramIndex++}`);
      params.push(input.due || null);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(JSON.stringify(input.tags));
    }
    if (input.links !== undefined) {
      updates.push(`links = $${paramIndex++}`);
      params.push(JSON.stringify(input.links));
    }

    if (updates.length === 0) return this.getById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE tasks_v2 SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const rows = await runQuery(sql, params);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      tags: parseValue(row.tags, true),
      links: parseValue(row.links, true),
    };
  },

  async delete(id: number): Promise<boolean> {
    await runQuery("DELETE FROM tasks_v2 WHERE id = $1", [id]);
    return true;
  },
};

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

export const sessions = {
  async start(input: CreateSessionInput = {}): Promise<Session> {
    const sql = `
      INSERT INTO sessions (task_id, start_time)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await runInsert(sql, [
      input.task_id || null,
      input.start_time || new Date(),
    ]);
    if (result.rows[0]) {
      return result.rows[0];
    }
    const fetched = await sessions.getById(result.insertId!);
    if (!fetched) throw new Error("Failed to create session");
    return fetched;
  },

  async end(id: number, input: { end_time?: Date; notes?: string } = {}): Promise<Session | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    updates.push(`end_time = $${paramIndex++}`);
    params.push(input.end_time || new Date());

    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(input.notes || null);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE sessions SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const rows = await runQuery(sql, params);
    return rows[0] || null;
  },

  async getById(id: number): Promise<Session | null> {
    const rows = await runQuery("SELECT * FROM sessions WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listByDay(date: Date): Promise<Session[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sql = `
      SELECT * FROM sessions
      WHERE start_time >= $1 AND start_time <= $2
      ORDER BY start_time ASC
    `;
    return await runQuery(sql, [startOfDay, endOfDay]);
  },

  async listByTask(taskId: number): Promise<Session[]> {
    const sql = `
      SELECT * FROM sessions
      WHERE task_id = $1
      ORDER BY start_time DESC
    `;
    return await runQuery(sql, [taskId]);
  },

  async getActive(): Promise<Session | null> {
    const sql = `
      SELECT * FROM sessions
      WHERE end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `;
    const rows = await runQuery(sql, []);
    return rows[0] || null;
  },
};

function parseTimeboxToMinutes(timebox: string | null): number {
  if (!timebox) return 0;
  const match = timebox.match(/^(\d+)(m|h)$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  return match[2] === "h" ? value * 60 : value;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function generateTodaysPlan(date: Date = new Date()): Promise<{
  date: string;
  work: { events: any[]; tasks: any[] };
  personal: { events: any[]; tasks: any[] };
  chapters: string[];
}> {
  const dayEvents = await events.listByDay(date);
  const dayTasks = await tasksV2.list({
    status: "ready",
    limit: 20,
  });

  const workEvents = dayEvents.filter((e) => e.type === "work");
  const personalEvents = dayEvents.filter((e) => ["hobby", "self-care", "social", "health"].includes(e.type));

  const workTasks = dayTasks.filter((t) => t.tags?.includes("work") || !t.tags?.length);
  const personalTasks = dayTasks.filter((t) => t.tags?.some((tag: string) => ["hobby", "health", "learning", "personal"].includes(tag)));

  const chapters: string[] = [];
  if (workEvents.length > 0 || workTasks.length > 0) chapters.push("Work");
  if (personalEvents.length > 0 || personalTasks.length > 0) chapters.push("Personal");

  return {
    date: formatDate(date),
    work: { events: workEvents, tasks: workTasks },
    personal: { events: personalEvents, tasks: personalTasks },
    chapters,
  };
}

export async function generateTodaysLog(date: Date = new Date()): Promise<{
  date: string;
  sessions: Session[];
  completedTasks: TaskV2[];
  blockedTasks: TaskV2[];
  narrative: string;
}> {
  const daySessions = await sessions.listByDay(date);
  const dayTasks = await tasksV2.list({});

  const completedTasks = dayTasks.filter((t) => t.status === "done" && new Date(t.updated_at).toDateString() === date.toDateString());
  const blockedTasks = dayTasks.filter((t) => t.status === "blocked");

  const totalMinutes = daySessions.reduce((sum, s) => {
    if (s.end_time) {
      return sum + Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000);
    }
    return sum;
  }, 0);

  const narrative = [
    completedTasks.length > 0 ? `Completed ${completedTasks.length} task(s)` : "No tasks completed today",
    blockedTasks.length > 0 ? `${blockedTasks.length} task(s) blocked` : "",
    `${totalMinutes} minutes logged in sessions`,
  ]
    .filter(Boolean)
    .join(". ") + ".";

  return {
    date: formatDate(date),
    sessions: daySessions,
    completedTasks,
    blockedTasks,
    narrative,
  };
}

export async function suggestEveningMicroSprint(date: Date = new Date()): Promise<{
  availableMinutes: number;
  suggestedTasks: TaskV2[];
  calendarBlocks: Event[];
}> {
  const now = new Date(date);
  const eveningStart = new Date(date);
  eveningStart.setHours(18, 0, 0, 0);
  const midnight = new Date(date);
  midnight.setHours(23, 59, 59, 999);

  if (now > eveningStart) {
    eveningStart.setTime(now.getTime());
  }

  const dayEvents = await events.listByDay(date);
  const eveningEvents = dayEvents.filter((e) => new Date(e.start_time) >= eveningStart);

  const usedMinutes = eveningEvents.reduce((sum, e) => {
    return sum + Math.round((new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000);
  }, 0);

  const availableMinutes = Math.max(0, 180 - usedMinutes);

  const hobbyTasks = await tasksV2.list({
    status: "ready",
    limit: 5,
  });

  const sortedHobbyTasks = hobbyTasks
    .filter((t) => t.tags?.some((tag: string) => ["hobby", "learning", "pixel-office"].includes(tag)))
    .sort((a, b) => {
      const aMins = parseTimeboxToMinutes(a.timebox);
      const bMins = parseTimeboxToMinutes(b.timebox);
      return aMins - bMins;
    });

  const suggestedTasks: TaskV2[] = [];
  let accumulated = 0;

  for (const task of sortedHobbyTasks) {
    const taskMinutes = parseTimeboxToMinutes(task.timebox) || 30;
    if (accumulated + taskMinutes <= availableMinutes && suggestedTasks.length < 2) {
      suggestedTasks.push(task);
      accumulated += taskMinutes;
    }
  }

  return {
    availableMinutes,
    suggestedTasks,
    calendarBlocks: eveningEvents,
  };
}
