/**
 * Storage adapter: uses Vercel KV on Vercel, local filesystem in dev.
 * Switch is automatic — if KV_REST_API_URL env var is present, KV is used.
 */

import { Ticket, TicketStatus, DashboardStats } from './types';

const IS_KV = !!process.env.KV_REST_API_URL;

// ─── KV helpers (lazy import so build works without KV env vars) ──────────────

async function kvGet<T>(key: string): Promise<T | null> {
  const { kv } = await import('@vercel/kv');
  return kv.get<T>(key);
}
async function kvSet(key: string, value: unknown): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.set(key, value);
}
async function kvDel(...keys: string[]): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.del(...(keys as [string, ...string[]]));
}
async function kvSAdd(key: string, ...members: string[]): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.sadd(key, members[0], ...members.slice(1));
}
async function kvSRem(key: string, member: string): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.srem(key, member);
}
async function kvSMembers(key: string): Promise<string[]> {
  const { kv } = await import('@vercel/kv');
  const result = await kv.smembers(key);
  return result.map(String);
}

// ─── KV storage ──────────────────────────────────────────────────────────────

async function kvGetAllTickets(): Promise<Ticket[]> {
  const ids = await kvSMembers('ticket-ids');
  if (!ids.length) return [];
  const tickets = await Promise.all(ids.map((id) => kvGet<Ticket>(`ticket:${id}`)));
  return (tickets.filter(Boolean) as Ticket[]).sort((a, b) => a.id.localeCompare(b.id));
}

async function kvGetTicketById(id: string): Promise<Ticket | null> {
  return kvGet<Ticket>(`ticket:${id}`);
}

async function kvCreateTicket(
  data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>
): Promise<Ticket> {
  const ids = await kvSMembers('ticket-ids');
  const maxNum = ids.reduce((max, id) => {
    const n = parseInt(String(id).replace('ticket-', ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  const id = `ticket-${String(maxNum + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    ...data,
    id,
    status: 'todo',
    created_at: now,
    updated_at: now,
    activity_log_file: `activity-${id}.md`,
  };
  await kvSet(`ticket:${id}`, ticket);
  await kvSAdd('ticket-ids', id);
  await kvAppendActivityLog(id, 'Lead', 'created', `Ticket registered: ${ticket.title}`);
  return ticket;
}

async function kvUpdateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
  const ticket = await kvGetTicketById(id);
  if (!ticket) return null;
  const updated = { ...ticket, ...updates, id, updated_at: new Date().toISOString() };
  await kvSet(`ticket:${id}`, updated);
  return updated;
}

async function kvDeleteTicket(id: string): Promise<boolean> {
  const ticket = await kvGetTicketById(id);
  if (!ticket) return false;
  await kvDel(`ticket:${id}`, `log:${id}`);
  await kvSRem('ticket-ids', id);
  return true;
}

async function kvGetActivityLog(id: string): Promise<string> {
  return (await kvGet<string>(`log:${id}`)) ?? '';
}

async function kvAppendActivityLog(
  id: string,
  agent: string,
  type: string,
  message: string,
  details?: string
): Promise<void> {
  const existing = (await kvGet<string>(`log:${id}`)) ?? '';
  const entry = buildLogEntry(type, agent, message, details);
  await kvSet(`log:${id}`, existing + entry);
}

// ─── Filesystem storage (local dev) ──────────────────────────────────────────

import fs from 'fs';
import path from 'path';

const KANBAN_ROOT = path.join(process.cwd(), 'taskforce_kanban');
const FOLDERS: Record<TicketStatus, string> = {
  todo: path.join(KANBAN_ROOT, 'todo'),
  in_progress: path.join(KANBAN_ROOT, 'in_progress'),
  done: path.join(KANBAN_ROOT, 'done'),
};
const LOGS_DIR = path.join(KANBAN_ROOT, 'logs');

function ensureDirs() {
  [KANBAN_ROOT, ...Object.values(FOLDERS), LOGS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function fsGetAllTickets(): Ticket[] {
  ensureDirs();
  const tickets: Ticket[] = [];
  for (const [status, folder] of Object.entries(FOLDERS)) {
    if (!fs.existsSync(folder)) continue;
    for (const file of fs.readdirSync(folder).filter((f) => f.endsWith('.json'))) {
      try {
        const ticket = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf-8')) as Ticket;
        ticket.status = status as TicketStatus;
        tickets.push(ticket);
      } catch { /* skip */ }
    }
  }
  return tickets.sort((a, b) => a.id.localeCompare(b.id));
}

function fsGetTicketById(id: string): Ticket | null {
  ensureDirs();
  for (const [status, folder] of Object.entries(FOLDERS)) {
    const fp = path.join(folder, `${id}.json`);
    if (fs.existsSync(fp)) {
      const ticket = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Ticket;
      ticket.status = status as TicketStatus;
      return ticket;
    }
  }
  return null;
}

function fsCreateTicket(
  data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>
): Ticket {
  ensureDirs();
  const existing = fsGetAllTickets();
  const maxNum = existing.reduce((max, t) => {
    const n = parseInt(t.id.replace('ticket-', ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  const id = `ticket-${String(maxNum + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    ...data, id, status: 'todo', created_at: now, updated_at: now,
    activity_log_file: `activity-${id}.md`,
  };
  fs.writeFileSync(path.join(FOLDERS.todo, `${id}.json`), JSON.stringify(ticket, null, 2));
  fsAppendActivityLog(id, 'Lead', 'created', `Ticket registered: ${ticket.title}`);
  fsRefreshDashboard();
  return ticket;
}

function fsUpdateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
  ensureDirs();
  const ticket = fsGetTicketById(id);
  if (!ticket) return null;
  const newStatus = updates.status ?? ticket.status;
  const updated = { ...ticket, ...updates, id, updated_at: new Date().toISOString(), status: newStatus };
  const oldPath = path.join(FOLDERS[ticket.status], `${id}.json`);
  if (newStatus !== ticket.status && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  fs.writeFileSync(path.join(FOLDERS[newStatus], `${id}.json`), JSON.stringify(updated, null, 2));
  fsRefreshDashboard();
  return updated;
}

function fsDeleteTicket(id: string): boolean {
  const ticket = fsGetTicketById(id);
  if (!ticket) return false;
  const fp = path.join(FOLDERS[ticket.status], `${id}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  const lp = path.join(LOGS_DIR, `activity-${id}.md`);
  if (fs.existsSync(lp)) fs.unlinkSync(lp);
  fsRefreshDashboard();
  return true;
}

function fsGetActivityLog(id: string): string {
  ensureDirs();
  const lp = path.join(LOGS_DIR, `activity-${id}.md`);
  return fs.existsSync(lp) ? fs.readFileSync(lp, 'utf-8') : '';
}

function fsAppendActivityLog(id: string, agent: string, type: string, message: string, details?: string) {
  ensureDirs();
  fs.appendFileSync(path.join(LOGS_DIR, `activity-${id}.md`), buildLogEntry(type, agent, message, details));
}

function fsRefreshDashboard() {
  const tickets = fsGetAllTickets();
  const todo = tickets.filter(t => t.status === 'todo');
  const inProg = tickets.filter(t => t.status === 'in_progress');
  const done = tickets.filter(t => t.status === 'done');
  const fmt = (t: Ticket) => `- **${t.id}**: ${t.title} [${t.priority}]${t.assignee ? ` → ${t.assignee}` : ''}`;
  const content = [
    '# TaskForce Kanban Dashboard',
    `Last updated: ${new Date().toISOString()}`,
    `Total: ${tickets.length} | Todo: ${todo.length} | In Progress: ${inProg.length} | Done: ${done.length}`,
    '', `## To Do (${todo.length})`, todo.length ? todo.map(fmt).join('\n') : '_No tickets_',
    '', `## In Progress (${inProg.length})`, inProg.length ? inProg.map(fmt).join('\n') : '_No tickets_',
    '', `## Done (${done.length})`, done.length ? done.map(fmt).join('\n') : '_No tickets_',
  ].join('\n');
  fs.writeFileSync(path.join(KANBAN_ROOT, 'taskforce_dashboard.md'), content);
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function buildLogEntry(type: string, agent: string, message: string, details?: string): string {
  const emoji: Record<string, string> = {
    created: '🟢', claimed: '🔵', update: '🟡', blocked: '🔴', completed: '✅', note: '📝',
  };
  return [
    `## ${emoji[type] ?? '📝'} ${type.toUpperCase()} — ${new Date().toISOString()}`,
    `**Agent:** ${agent}`,
    `**Message:** ${message}`,
    details ? `**Details:**\n${details}` : '',
    '---', '',
  ].filter(Boolean).join('\n') + '\n';
}

// ─── Public API (async, works with both backends) ────────────────────────────

export async function getAllTickets(): Promise<Ticket[]> {
  return IS_KV ? kvGetAllTickets() : fsGetAllTickets();
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  return IS_KV ? kvGetTicketById(id) : fsGetTicketById(id);
}

export async function createTicket(
  data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>
): Promise<Ticket> {
  return IS_KV ? kvCreateTicket(data) : fsCreateTicket(data);
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
  return IS_KV ? kvUpdateTicket(id, updates) : fsUpdateTicket(id, updates);
}

export async function deleteTicket(id: string): Promise<boolean> {
  return IS_KV ? kvDeleteTicket(id) : fsDeleteTicket(id);
}

export async function getActivityLog(id: string): Promise<string> {
  return IS_KV ? kvGetActivityLog(id) : fsGetActivityLog(id);
}

export async function appendActivityLog(
  id: string, agent: string, type: string, message: string, details?: string
): Promise<void> {
  return IS_KV
    ? kvAppendActivityLog(id, agent, type, message, details)
    : fsAppendActivityLog(id, agent, type, message, details);
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
