export type TicketStatus = 'todo' | 'in_progress' | 'done';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  assignee: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  priority: TicketPriority;
  dependencies: string[];
  labels: string[];
  activity_log_file: string;
}

export interface ActivityLogEntry {
  timestamp: string;
  agent: string;
  type: 'created' | 'claimed' | 'update' | 'blocked' | 'completed';
  message: string;
  details?: string;
}

export interface DashboardStats {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  lastUpdated: string;
  agents: string[];
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  priority: TicketPriority;
  labels: string[];
  dependencies?: string[];
  assignee?: string;
}

export interface UpdateTicketPayload {
  title?: string;
  description?: string;
  status?: TicketStatus;
  assignee?: string | null;
  priority?: TicketPriority;
  labels?: string[];
  dependencies?: string[];
}
