import fs from 'fs';
import path from 'path';
import { Ticket, TicketStatus, DashboardStats } from './types';

const KANBAN_ROOT = path.join(process.cwd(), 'taskforce_kanban');
const FOLDERS: Record<TicketStatus, string> = {
  todo: path.join(KANBAN_ROOT, 'todo'),
  in_progress: path.join(KANBAN_ROOT, 'in_progress'),
  done: path.join(KANBAN_ROOT, 'done'),
};
const LOGS_DIR = path.join(KANBAN_ROOT, 'logs');

export function ensureDirs() {
  [KANBAN_ROOT, ...Object.values(FOLDERS), LOGS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

export function getAllTickets(): Ticket[] {
  ensureDirs();
  const tickets: Ticket[] = [];
  for (const [status, folder] of Object.entries(FOLDERS)) {
    if (!fs.existsSync(folder)) continue;
    const files = fs.readdirSync(folder).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(folder, file), 'utf-8');
        const ticket = JSON.parse(raw) as Ticket;
        ticket.status = status as TicketStatus;
        tickets.push(ticket);
      } catch {
        // skip malformed files
      }
    }
  }
  return tickets.sort((a, b) => a.id.localeCompare(b.id));
}

export function getTicketById(id: string): { ticket: Ticket; filePath: string } | null {
  ensureDirs();
  for (const [status, folder] of Object.entries(FOLDERS)) {
    const filePath = path.join(folder, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const ticket = JSON.parse(raw) as Ticket;
      ticket.status = status as TicketStatus;
      return { ticket, filePath };
    }
  }
  return null;
}

export function createTicket(data: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'activity_log_file'>): Ticket {
  ensureDirs();
  const existing = getAllTickets();
  const maxNum = existing.reduce((max, t) => {
    const num = parseInt(t.id.replace('ticket-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
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
  const filePath = path.join(FOLDERS.todo, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(ticket, null, 2));
  appendActivityLog(id, 'Lead', 'created', `Ticket registered: ${ticket.title}`);
  refreshDashboard();
  return ticket;
}

export function updateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
  const result = getTicketById(id);
  if (!result) return null;
  const { ticket, filePath } = result;
  const now = new Date().toISOString();
  const newStatus = updates.status ?? ticket.status;
  const updated: Ticket = { ...ticket, ...updates, id, updated_at: now, status: newStatus };
  // Move file if status changed
  if (newStatus !== ticket.status) {
    fs.unlinkSync(filePath);
    const newPath = path.join(FOLDERS[newStatus], `${id}.json`);
    fs.writeFileSync(newPath, JSON.stringify(updated, null, 2));
  } else {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  }
  refreshDashboard();
  return updated;
}

export function deleteTicket(id: string): boolean {
  const result = getTicketById(id);
  if (!result) return false;
  fs.unlinkSync(result.filePath);
  const logFile = path.join(LOGS_DIR, `activity-${id}.md`);
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  refreshDashboard();
  return true;
}

export function getActivityLog(id: string): string {
  ensureDirs();
  const logFile = path.join(LOGS_DIR, `activity-${id}.md`);
  if (!fs.existsSync(logFile)) return '';
  return fs.readFileSync(logFile, 'utf-8');
}

export function appendActivityLog(
  id: string,
  agent: string,
  type: string,
  message: string,
  details?: string
): void {
  ensureDirs();
  const logFile = path.join(LOGS_DIR, `activity-${id}.md`);
  const timestamp = new Date().toISOString();
  const typeEmoji: Record<string, string> = {
    created: '🟢',
    claimed: '🔵',
    update: '🟡',
    blocked: '🔴',
    completed: '✅',
    note: '📝',
  };
  const emoji = typeEmoji[type] ?? '📝';
  const entry = [
    `## ${emoji} ${type.toUpperCase()} — ${timestamp}`,
    `**Agent:** ${agent}`,
    `**Message:** ${message}`,
    details ? `**Details:**\n${details}` : '',
    '---',
    '',
  ]
    .filter(Boolean)
    .join('\n');
  fs.appendFileSync(logFile, entry + '\n');
}

export function getDashboardStats(): DashboardStats {
  const tickets = getAllTickets();
  const agents = [...new Set(tickets.map((t) => t.assignee).filter(Boolean))] as string[];
  return {
    total: tickets.length,
    todo: tickets.filter((t) => t.status === 'todo').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    done: tickets.filter((t) => t.status === 'done').length,
    lastUpdated: new Date().toISOString(),
    agents,
  };
}

export function refreshDashboard(): void {
  ensureDirs();
  const tickets = getAllTickets();
  const stats = getDashboardStats();
  const todo = tickets.filter((t) => t.status === 'todo');
  const inProgress = tickets.filter((t) => t.status === 'in_progress');
  const done = tickets.filter((t) => t.status === 'done');

  const formatTicket = (t: Ticket) =>
    `- **${t.id}**: ${t.title} [${t.priority}]${t.labels.length ? ` (${t.labels.join(', ')})` : ''}${t.assignee ? ` → ${t.assignee}` : ''}`;

  const content = [
    '# TaskForce Kanban Dashboard',
    `Last updated: ${stats.lastUpdated}`,
    `Total: ${stats.total} | Todo: ${stats.todo} | In Progress: ${stats.in_progress} | Done: ${stats.done}`,
    '',
    `## To Do (${todo.length})`,
    todo.length ? todo.map(formatTicket).join('\n') : '_No tickets_',
    '',
    `## In Progress (${inProgress.length})`,
    inProgress.length ? inProgress.map(formatTicket).join('\n') : '_No tickets_',
    '',
    `## Done (${done.length})`,
    done.length ? done.map(formatTicket).join('\n') : '_No tickets_',
    '',
    '## Active Agents',
    stats.agents.length ? stats.agents.map((a) => `- ${a}`).join('\n') : '_No active agents_',
    '',
    '## Quick Links',
    '- Ticket files: `taskforce_kanban/{todo,in_progress,done}/`',
    '- Activity logs: `taskforce_kanban/logs/`',
  ].join('\n');

  fs.writeFileSync(path.join(KANBAN_ROOT, 'taskforce_dashboard.md'), content);
}
