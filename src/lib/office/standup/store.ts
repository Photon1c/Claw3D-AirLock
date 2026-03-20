import fs from "node:fs";
import path from "node:path";

import {
  isSandboxMode,
  resolveSandboxDir,
  resolveStateDir,
} from "@/lib/clawdbot/paths";
import type { StandupMeeting, StandupMeetingStore } from "@/lib/office/standup/types";

const STORE_DIR = "claw3d";
const STORE_FILE = "standup-store.json";

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveStorePath = (env: NodeJS.ProcessEnv = process.env) => {
  const base = isSandboxMode(env)
    ? resolveSandboxDir()
    : resolveStateDir(env);
  const dir = path.join(base, STORE_DIR);
  ensureDirectory(dir);
  return path.join(dir, STORE_FILE);
};

const defaultStore = (): StandupMeetingStore => ({
  activeMeeting: null,
  lastMeeting: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeMeeting = (value: unknown): StandupMeeting | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (!Array.isArray(value.cards) || !Array.isArray(value.participantOrder)) return null;
  if (!Array.isArray(value.arrivedAgentIds)) return null;
  if (typeof value.startedAt !== "string" || typeof value.updatedAt !== "string") return null;
  return value as StandupMeeting;
};

const readStore = (env: NodeJS.ProcessEnv = process.env): StandupMeetingStore => {
  const storePath = resolveStorePath(env);
  if (!fs.existsSync(storePath)) {
    return defaultStore();
  }
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) return defaultStore();
  return {
    activeMeeting: normalizeMeeting(parsed.activeMeeting),
    lastMeeting: normalizeMeeting(parsed.lastMeeting),
  };
};

const writeStore = (store: StandupMeetingStore, env: NodeJS.ProcessEnv = process.env) => {
  const storePath = resolveStorePath(env);
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
};

export const loadStandupMeetingStore = (
  env: NodeJS.ProcessEnv = process.env
): StandupMeetingStore => readStore(env);

export const loadActiveStandupMeeting = (
  env: NodeJS.ProcessEnv = process.env
): StandupMeeting | null => readStore(env).activeMeeting;

export const saveStandupMeeting = (
  meeting: StandupMeeting | null,
  env: NodeJS.ProcessEnv = process.env
): StandupMeetingStore => {
  const current = readStore(env);
  const next: StandupMeetingStore = {
    activeMeeting: meeting,
    lastMeeting: meeting ?? current.lastMeeting,
  };
  if (meeting?.phase === "complete") {
    next.lastMeeting = meeting;
  }
  writeStore(next, env);
  return next;
};

export const updateStandupMeeting = (
  updater: (meeting: StandupMeeting | null) => StandupMeeting | null,
  env: NodeJS.ProcessEnv = process.env
): StandupMeetingStore => {
  const current = readStore(env);
  const nextMeeting = updater(current.activeMeeting);
  const nextStore: StandupMeetingStore = {
    activeMeeting: nextMeeting,
    lastMeeting:
      nextMeeting?.phase === "complete"
        ? nextMeeting
        : current.lastMeeting,
  };
  writeStore(nextStore, env);
  return nextStore;
};
