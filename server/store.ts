// File-backed state shared by the dev-server bridge (UI side) and the `ev` CLI (Claude side).
// Files are the only channel between the two, so every write is atomic (tmp + rename).
import { mkdirSync, openSync, closeSync, readdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureProjectsLayout, ROOT } from './projects.ts';
import type { AgentStatus, EditRequest, NewEditRequest, Point, Region, Scope, ThreadMessage } from '../src/shared/types.ts';

// There is always an active project at project/ (see projects.ts for how switching works).
ensureProjectsLayout();
export { ROOT };
export const PROJECT_DIR = join(ROOT, 'project');
export const EV_DIR = join(PROJECT_DIR, '.ev');
export const REQUESTS_DIR = join(EV_DIR, 'requests');
export const SNAPSHOTS_DIR = join(EV_DIR, 'snapshots');
const STATUS_FILE = join(EV_DIR, 'status.json');

/** A listening agent refreshes its heartbeat; older than this means nobody is listening. */
export const HEARTBEAT_STALE_MS = 20_000;

export function ensureDirs(): void {
  mkdirSync(REQUESTS_DIR, { recursive: true });
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

export function writeJsonAtomic(path: string, data: unknown): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, path);
}

const requestPath = (id: number) => join(REQUESTS_DIR, `${String(id).padStart(4, '0')}.json`);

export function listRequests(): EditRequest[] {
  ensureDirs();
  const out: EditRequest[] = [];
  for (const name of readdirSync(REQUESTS_DIR)) {
    if (!/^\d+\.json$/.test(name)) continue;
    try {
      out.push(JSON.parse(readFileSync(join(REQUESTS_DIR, name), 'utf8')) as EditRequest);
    } catch {
      // A half-written file can't happen with atomic writes; anything unparsable is skipped.
    }
  }
  return out.sort((a, b) => a.id - b.id);
}

export function getRequest(id: number): EditRequest | null {
  const path = requestPath(id);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as EditRequest) : null;
}

export function createRequest(input: NewEditRequest): EditRequest {
  ensureDirs();
  let id = (listRequests().at(-1)?.id ?? 0) + 1;
  // Reserve the id with an exclusive create so two simultaneous submits can't collide.
  for (;;) {
    try {
      closeSync(openSync(requestPath(id), 'wx'));
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      id++;
    }
  }
  const now = new Date().toISOString();
  const request: EditRequest = { id, createdAt: now, updatedAt: now, queuedAt: now, status: 'pending', thread: [], ...input };
  writeJsonAtomic(requestPath(id), request);
  return request;
}

export function updateRequest(id: number, patch: Partial<Omit<EditRequest, 'id'>>): EditRequest {
  const current = getRequest(id);
  if (!current) throw new Error(`Request #${id} not found`);
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeJsonAtomic(requestPath(id), next);
  return next;
}

/** Oldest pending request, flipped to `working`. Only the single Claude session calls this. */
/** The request that has waited longest (new, or re-queued by a user reply), set to `working`. */
export function claimNextPending(): EditRequest | null {
  const next = listRequests()
    .filter((r) => r.status === 'pending')
    .sort((a, b) => (a.queuedAt ?? a.createdAt).localeCompare(b.queuedAt ?? b.createdAt) || a.id - b.id)[0];
  return next ? updateRequest(next.id, { status: 'working' }) : null;
}

export function appendMessage(id: number, message: Omit<ThreadMessage, 'at'>, patch: Partial<Omit<EditRequest, 'id'>> = {}): EditRequest {
  const current = getRequest(id);
  if (!current) throw new Error(`Request #${id} not found`);
  const thread = [...(current.thread ?? []), { ...message, at: new Date().toISOString() }];
  return updateRequest(id, { ...patch, thread });
}

const MAX_REPLY = 2000;

/**
 * The user replied in a request's thread: an answer to Claude's question, a follow-up tweak
 * ("good, but slower") or a question ("why there?"). The request goes back in the queue with
 * its original context (frame, pin, layers), so the user never has to point again.
 */
export function replyToRequest(id: number, text: string): EditRequest {
  const request = getRequest(id);
  if (!request) throw new Error(`Request #${id} not found`);
  const clean = text.trim();
  if (!clean) throw new Error('reply is empty');
  if (clean.length > MAX_REPLY) throw new Error('reply is too long');
  if (request.status === 'pending' || request.status === 'working') throw new Error('Claude is already on this request; reply when it has answered');
  return appendMessage(id, { from: 'user', kind: 'reply', text: clean }, { status: 'pending', queuedAt: new Date().toISOString() });
}

export function readAgentStatus(): AgentStatus {
  try {
    const status = JSON.parse(readFileSync(STATUS_FILE, 'utf8')) as AgentStatus;
    const stale = Date.now() - Date.parse(status.heartbeat) > HEARTBEAT_STALE_MS;
    // A working agent may legitimately be silent for minutes (long edits); only listening goes stale.
    return status.state === 'listening' && stale ? { ...status, state: 'offline' } : status;
  } catch {
    return { state: 'offline', message: '', requestId: null, heartbeat: new Date(0).toISOString() };
  }
}

export function writeAgentStatus(status: Omit<AgentStatus, 'heartbeat'>): void {
  ensureDirs();
  writeJsonAtomic(STATUS_FILE, { ...status, heartbeat: new Date().toISOString() });
}

// ---- Validation of untrusted input from the browser -------------------------------------

const SCOPES: readonly Scope[] = ['frame', 'scene', 'range', 'video'];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parsePoint(v: unknown): Point | null {
  if (v == null) return null;
  const p = v as Record<string, unknown>;
  if (!isNum(p.x) || !isNum(p.y)) throw new Error('pin must be {x, y}');
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

function parseRegion(v: unknown): Region | null {
  if (v == null) return null;
  const r = v as Record<string, unknown>;
  if (!isNum(r.x) || !isNum(r.y) || !isNum(r.w) || !isNum(r.h)) throw new Error('region must be {x, y, w, h}');
  return { x: clamp01(r.x), y: clamp01(r.y), w: clamp01(r.w), h: clamp01(r.h) };
}

export function parseNewRequest(body: unknown): NewEditRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : '';
  if (!prompt) throw new Error('prompt is required');
  if (prompt.length > 4000) throw new Error('prompt is too long');
  if (!SCOPES.includes(b.scope as Scope)) throw new Error(`scope must be one of ${SCOPES.join(', ')}`);
  if (!isNum(b.frame) || b.frame < 0) throw new Error('frame must be a non-negative number');
  const layers = Array.isArray(b.layers) ? b.layers.filter((l): l is string => typeof l === 'string').slice(0, 12) : [];
  const range = parseRange(b.range);
  if (b.scope === 'range' && !range) throw new Error('scope "range" needs a range {start, end}');
  return {
    prompt,
    scope: b.scope as Scope,
    frame: Math.round(b.frame),
    sceneId: typeof b.sceneId === 'string' ? b.sceneId : null,
    pin: parsePoint(b.pin),
    region: parseRegion(b.region),
    layers,
    range,
  };
}

function parseRange(v: unknown): { start: number; end: number } | null {
  if (v == null) return null;
  const r = v as Record<string, unknown>;
  if (!isNum(r.start) || !isNum(r.end) || r.start < 0 || r.end < r.start) throw new Error('range must be {start, end} with 0 ≤ start ≤ end');
  return { start: Math.round(r.start), end: Math.round(r.end) };
}
