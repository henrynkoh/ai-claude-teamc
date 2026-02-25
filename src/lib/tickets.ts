/**
 * Storage adapter — auto-selects backend by env vars:
 *  1. GitHub API  (GITHUB_TOKEN)     → JSON files in 'data' branch
 *  2. Vercel KV   (KV_REST_API_URL)  → Redis via @vercel/kv
 *  3. Local fs    (dev fallback)     → taskforce_kanban/ folder
 */

import { Ticket, TicketStatus, DashboardStats } from './types';
import { cacheGet, cacheSet, cacheDel, cacheInvalidatePrefix } from './cache';

const USE_GITHUB = !!process.env.GITHUB_TOKEN;
const USE_KV     = !USE_GITHUB && !!process.env.KV_REST_API_URL;

const GH_OWNER  = process.env.GITHUB_OWNER  ?? 'henrynkoh';
const GH_REPO   = process.env.GITHUB_REPO   ?? 'ai-claude-teamc';
const GH_BRANCH = process.env.GITHUB_BRANCH ?? 'data';
const STATUSES: TicketStatus[] = ['todo', 'in_progress', 'done'];

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function ghApi(path: string, opts: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function ghGetFile(path: string): Promise<{ content: string; sha: string } | null> {
  const data = await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`);
  if (!data || data.type !== 'file') return null;
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

async function ghPutFile(path: string, content: string, message: string, sha?: string) {
  await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      branch: GH_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function ghDeleteFile(path: string, message: string, sha: string) {
  await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, branch: GH_BRANCH, sha }),
  });
}

async function ghListDir(dir: string): Promise<Array<{ name: string; sha: string; download_url: string }>> {
  const data = await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/contents/${dir}?ref=${GH_BRANCH}`);
  if (!Array.isArray(data)) return [];
  return data.filter((f: { type: string }) => f.type === 'file');
}

let branchEnsured = false;
async function ensureDataBranch() {
  if (branchEnsured) return;
  const branch = await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/branches/${GH_BRANCH}`);
  if (!branch) {
    const main = await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/branches/main`);
    await ghApi(`/repos/${GH_OWNER}/${GH_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${GH_BRANCH}`, sha: main.commit.sha }),
    });
  }
  branchEnsured = true;
}

// Fetch all tickets for a status column in parallel via raw download URLs
async function ghFetchColumn(status: TicketStatus): Promise<Ticket[]> {
  const cKey = `gh:col:${status}`;
  const cached = cacheGet<Ticket[]>(cKey);
  if (cached) return cached;

  const files = await ghListDir(`tickets/${status}`);
  const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
  if (!jsonFiles.length) return cacheSet(cKey, []);

  // Parallel fetch via download_url (no auth needed, faster)
  const results = await Promise.allSettled(
    jsonFiles.map(async (f) => {
      const cFileKey = `gh:file:${status}/${f.name}`;
      const cachedFile = cacheGet<Ticket>(cFileKey);
      if (cachedFile) return cachedFile;
      const res = await fetch(f.download_url);
      const t = (await res.json()) as Ticket;
      t.status = status;
      cacheSet(cFileKey, t);
      return t;
    })
  );

  const tickets = results
    .filter((r): r is PromiseFulfilledResult<Ticket> => r.status === 'fulfilled')
    .map((r) => r.value);
  return cacheSet(cKey, tickets);
}

async function ghGetAllTickets(): Promise<Ticket[]> {
  await ensureDataBranch();
  const columns = await Promise.all(STATUSES.map(ghFetchColumn));
  return columns.flat().sort((a, b) => a.id.localeCompare(b.id));
}

async function ghGetTicketById(id: string): Promise<{ ticket: Ticket; sha: string; status: TicketStatus } | null> {
  for (const status of STATUSES) {
    const file = await ghGetFile(`tickets/${status}/${id}.json`);
    if (file) {
      const ticket = JSON.parse(file.content) as Ticket;
      ticket.status = status;
      return { ticket, sha: file.sha, status };
    }
  }
  return null;
}

async function ghCreateTicket(
  data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>
): Promise<Ticket> {
  await ensureDataBranch();
  const existing = await ghGetAllTickets();
  const maxNum = existing.reduce((m, t) => {
    const n = parseInt(t.id.replace('ticket-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const id = `ticket-${String(maxNum + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    ...data, id, status: 'todo', created_at: now, updated_at: now,
    activity_log_file: `activity-${id}.md`,
  };
  await ghPutFile(`tickets/todo/${id}.json`, JSON.stringify(ticket, null, 2), `create ${id}`);
  cacheInvalidatePrefix('gh:col:todo');
  await ghAppendLog(id, 'Lead', 'created', `Ticket registered: ${ticket.title}`);
  return ticket;
}

async function ghUpdateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
  const result = await ghGetTicketById(id);
  if (!result) return null;
  const newStatus = (updates.status ?? result.ticket.status) as TicketStatus;
  const updated: Ticket = {
    ...result.ticket, ...updates, id,
    updated_at: new Date().toISOString(), status: newStatus,
  };
  if (newStatus !== result.status) {
    await ghDeleteFile(`tickets/${result.status}/${id}.json`, `move ${id}→${newStatus}`, result.sha);
    await ghPutFile(`tickets/${newStatus}/${id}.json`, JSON.stringify(updated, null, 2), `update ${id}`);
    cacheInvalidatePrefix(`gh:col:${result.status}`);
  } else {
    await ghPutFile(`tickets/${result.status}/${id}.json`, JSON.stringify(updated, null, 2), `update ${id}`, result.sha);
  }
  cacheInvalidatePrefix(`gh:col:${newStatus}`);
  cacheDel(`gh:file:${result.status}/${id}.json`);
  return updated;
}

async function ghDeleteTicket(id: string): Promise<boolean> {
  const result = await ghGetTicketById(id);
  if (!result) return false;
  await ghDeleteFile(`tickets/${result.status}/${id}.json`, `delete ${id}`, result.sha);
  const log = await ghGetFile(`logs/activity-${id}.md`);
  if (log) await ghDeleteFile(`logs/activity-${id}.md`, `delete log ${id}`, log.sha);
  cacheInvalidatePrefix(`gh:col:${result.status}`);
  cacheDel(`gh:file:${result.status}/${id}.json`, `gh:log:${id}`);
  return true;
}

async function ghGetLog(id: string): Promise<string> {
  const cached = cacheGet<string>(`gh:log:${id}`);
  if (cached !== null) return cached;
  const file = await ghGetFile(`logs/activity-${id}.md`);
  return cacheSet(`gh:log:${id}`, file?.content ?? '', 5_000);
}

async function ghAppendLog(id: string, agent: string, type: string, message: string, details?: string) {
  const existing = await ghGetFile(`logs/activity-${id}.md`);
  const entry = buildLogEntry(type, agent, message, details);
  const content = (existing?.content ?? '') + entry;
  await ghPutFile(`logs/activity-${id}.md`, content, `log ${id}`, existing?.sha);
  cacheDel(`gh:log:${id}`);
}

// ─── Vercel KV storage ────────────────────────────────────────────────────────

async function kvGet<T>(key: string): Promise<T | null> {
  const { kv } = await import('@vercel/kv');
  return kv.get<T>(key);
}
async function kvSet(key: string, value: unknown) {
  const { kv } = await import('@vercel/kv');
  await kv.set(key, value);
}
async function kvDel(...keys: string[]) {
  const { kv } = await import('@vercel/kv');
  await kv.del(...(keys as [string, ...string[]]));
}
async function kvSAdd(key: string, member: string) {
  const { kv } = await import('@vercel/kv');
  await kv.sadd(key, member);
}
async function kvSRem(key: string, member: string) {
  const { kv } = await import('@vercel/kv');
  await kv.srem(key, member);
}
async function kvSMembers(key: string): Promise<string[]> {
  const { kv } = await import('@vercel/kv');
  return (await kv.smembers(key)).map(String);
}
async function kvGetAll(): Promise<Ticket[]> {
  const ids = await kvSMembers('ticket-ids');
  if (!ids.length) return [];
  const tickets = await Promise.all(ids.map((id) => kvGet<Ticket>(`ticket:${id}`)));
  return (tickets.filter(Boolean) as Ticket[]).sort((a, b) => a.id.localeCompare(b.id));
}
async function kvGetById(id: string) { return kvGet<Ticket>(`ticket:${id}`); }
async function kvCreate(data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>): Promise<Ticket> {
  const ids = await kvSMembers('ticket-ids');
  const max = ids.reduce((m, id) => Math.max(m, parseInt(String(id).replace('ticket-', ''), 10) || 0), 0);
  const id = `ticket-${String(max + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const ticket: Ticket = { ...data, id, status: 'todo', created_at: now, updated_at: now, activity_log_file: `activity-${id}.md` };
  await kvSet(`ticket:${id}`, ticket);
  await kvSAdd('ticket-ids', id);
  await kvAppend(id, 'Lead', 'created', `Ticket registered: ${ticket.title}`);
  return ticket;
}
async function kvUpdate(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
  const t = await kvGetById(id); if (!t) return null;
  const updated = { ...t, ...updates, id, updated_at: new Date().toISOString() };
  await kvSet(`ticket:${id}`, updated); return updated;
}
async function kvDelete(id: string): Promise<boolean> {
  const t = await kvGetById(id); if (!t) return false;
  await kvDel(`ticket:${id}`, `log:${id}`); await kvSRem('ticket-ids', id); return true;
}
async function kvGetLog(id: string): Promise<string> { return (await kvGet<string>(`log:${id}`)) ?? ''; }
async function kvAppend(id: string, agent: string, type: string, message: string, details?: string) {
  const existing = (await kvGet<string>(`log:${id}`)) ?? '';
  await kvSet(`log:${id}`, existing + buildLogEntry(type, agent, message, details));
}

// ─── Local filesystem storage ─────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'taskforce_kanban');
const DIRS: Record<TicketStatus, string> = {
  todo: path.join(ROOT, 'todo'),
  in_progress: path.join(ROOT, 'in_progress'),
  done: path.join(ROOT, 'done'),
};
const LOGS_DIR = path.join(ROOT, 'logs');

function mkdirs() {
  [ROOT, ...Object.values(DIRS), LOGS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}
function fsGetAll(): Ticket[] {
  mkdirs();
  const out: Ticket[] = [];
  for (const [status, dir] of Object.entries(DIRS)) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Ticket;
        t.status = status as TicketStatus; out.push(t);
      } catch { /* skip */ }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
function fsGetById(id: string): Ticket | null {
  mkdirs();
  for (const [status, dir] of Object.entries(DIRS)) {
    const fp = path.join(dir, `${id}.json`);
    if (fs.existsSync(fp)) {
      const t = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Ticket;
      t.status = status as TicketStatus; return t;
    }
  }
  return null;
}
function fsCreate(data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>): Ticket {
  mkdirs();
  const max = fsGetAll().reduce((m, t) => Math.max(m, parseInt(t.id.replace('ticket-', ''), 10) || 0), 0);
  const id = `ticket-${String(max + 1).padStart(3, '0')}`, now = new Date().toISOString();
  const ticket: Ticket = { ...data, id, status: 'todo', created_at: now, updated_at: now, activity_log_file: `activity-${id}.md` };
  fs.writeFileSync(path.join(DIRS.todo, `${id}.json`), JSON.stringify(ticket, null, 2));
  fsAppend(id, 'Lead', 'created', `Ticket registered: ${ticket.title}`);
  fsRefresh(); return ticket;
}
function fsUpdate(id: string, updates: Partial<Ticket>): Ticket | null {
  mkdirs();
  const t = fsGetById(id); if (!t) return null;
  const ns = (updates.status ?? t.status) as TicketStatus;
  const updated = { ...t, ...updates, id, updated_at: new Date().toISOString(), status: ns };
  const old = path.join(DIRS[t.status], `${id}.json`);
  if (ns !== t.status && fs.existsSync(old)) fs.unlinkSync(old);
  fs.writeFileSync(path.join(DIRS[ns], `${id}.json`), JSON.stringify(updated, null, 2));
  fsRefresh(); return updated;
}
function fsDelete(id: string): boolean {
  const t = fsGetById(id); if (!t) return false;
  const fp = path.join(DIRS[t.status], `${id}.json`); if (fs.existsSync(fp)) fs.unlinkSync(fp);
  const lp = path.join(LOGS_DIR, `activity-${id}.md`); if (fs.existsSync(lp)) fs.unlinkSync(lp);
  fsRefresh(); return true;
}
function fsGetLog(id: string): string {
  mkdirs(); const lp = path.join(LOGS_DIR, `activity-${id}.md`);
  return fs.existsSync(lp) ? fs.readFileSync(lp, 'utf-8') : '';
}
function fsAppend(id: string, agent: string, type: string, message: string, details?: string) {
  mkdirs(); fs.appendFileSync(path.join(LOGS_DIR, `activity-${id}.md`), buildLogEntry(type, agent, message, details));
}
function fsRefresh() {
  const tickets = fsGetAll();
  const fmt = (t: Ticket) => `- **${t.id}**: ${t.title} [${t.priority}]${t.assignee ? ` → ${t.assignee}` : ''}`;
  const todo = tickets.filter(t => t.status === 'todo');
  const ip = tickets.filter(t => t.status === 'in_progress');
  const done = tickets.filter(t => t.status === 'done');
  fs.writeFileSync(path.join(ROOT, 'taskforce_dashboard.md'), [
    '# TaskForce Kanban Dashboard', `Last updated: ${new Date().toISOString()}`,
    `Total: ${tickets.length} | Todo: ${todo.length} | In Progress: ${ip.length} | Done: ${done.length}`,
    '', `## To Do (${todo.length})`, todo.length ? todo.map(fmt).join('\n') : '_No tickets_',
    '', `## In Progress (${ip.length})`, ip.length ? ip.map(fmt).join('\n') : '_No tickets_',
    '', `## Done (${done.length})`, done.length ? done.map(fmt).join('\n') : '_No tickets_',
  ].join('\n'));
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function buildLogEntry(type: string, agent: string, message: string, details?: string): string {
  const emoji: Record<string, string> = {
    created: '🟢', claimed: '🔵', update: '🟡', blocked: '🔴', completed: '✅', note: '📝',
  };
  return [
    `## ${emoji[type] ?? '📝'} ${type.toUpperCase()} — ${new Date().toISOString()}`,
    `**Agent:** ${agent}`, `**Message:** ${message}`,
    details ? `**Details:**\n${details}` : '', '---', '',
  ].filter(Boolean).join('\n') + '\n';
}

// ─── Public async API ─────────────────────────────────────────────────────────

export async function getAllTickets(): Promise<Ticket[]> {
  if (USE_GITHUB) return ghGetAllTickets();
  if (USE_KV) return kvGetAll();
  return fsGetAll();
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  if (USE_GITHUB) return (await ghGetTicketById(id))?.ticket ?? null;
  if (USE_KV) return kvGetById(id);
  return fsGetById(id);
}

export async function createTicket(
  data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>
): Promise<Ticket> {
  if (USE_GITHUB) return ghCreateTicket(data);
  if (USE_KV) return kvCreate(data);
  return fsCreate(data);
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
  if (USE_GITHUB) return ghUpdateTicket(id, updates);
  if (USE_KV) return kvUpdate(id, updates);
  return fsUpdate(id, updates);
}

export async function deleteTicket(id: string): Promise<boolean> {
  if (USE_GITHUB) return ghDeleteTicket(id);
  if (USE_KV) return kvDelete(id);
  return fsDelete(id);
}

export async function getActivityLog(id: string): Promise<string> {
  if (USE_GITHUB) return ghGetLog(id);
  if (USE_KV) return kvGetLog(id);
  return fsGetLog(id);
}

export async function appendActivityLog(
  id: string, agent: string, type: string, message: string, details?: string
): Promise<void> {
  if (USE_GITHUB) return ghAppendLog(id, agent, type, message, details);
  if (USE_KV) return kvAppend(id, agent, type, message, details);
  fsAppend(id, agent, type, message, details);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const tickets = await getAllTickets();
  const agents = [...new Set(tickets.map(t => t.assignee).filter(Boolean))] as string[];
  return {
    total: tickets.length,
    todo: tickets.filter(t => t.status === 'todo').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    done: tickets.filter(t => t.status === 'done').length,
    lastUpdated: new Date().toISOString(),
    agents,
  };
}
