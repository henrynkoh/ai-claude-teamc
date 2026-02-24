#!/usr/bin/env node
/**
 * TaskForce.AI MCP Server
 * Connects Claude agents directly to the Kanban board via MCP protocol.
 * Run: npx tsx mcp-server/server.ts
 * Then add to ~/.claude/claude_desktop_config.json or claude_code_config.json
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = process.env.TASKFORCE_URL ?? 'http://localhost:3000';

async function apiCall(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const TOOLS: Tool[] = [
  {
    name: 'taskforce_get_dashboard',
    description: 'Get the current Kanban dashboard: stats and all tickets grouped by status.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'taskforce_list_tickets',
    description: 'List all tickets. Optionally filter by status or label.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Filter by status' },
        label: { type: 'string', description: 'Filter by label (e.g. "backend")' },
      },
    },
  },
  {
    name: 'taskforce_create_ticket',
    description: 'Create a new ticket in the To Do column.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Short task title' },
        description: { type: 'string', description: 'Detailed description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
        labels: { type: 'array', items: { type: 'string' }, description: 'e.g. ["backend","api"]' },
        assignee: { type: 'string', description: 'Agent name to pre-assign' },
        dependencies: { type: 'array', items: { type: 'string' }, description: 'Ticket IDs this depends on' },
      },
    },
  },
  {
    name: 'taskforce_get_ticket',
    description: 'Get a specific ticket by ID.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Ticket ID e.g. ticket-001' } },
    },
  },
  {
    name: 'taskforce_claim_ticket',
    description: 'Claim a ticket: assign yourself and move it to In Progress.',
    inputSchema: {
      type: 'object',
      required: ['id', 'agent'],
      properties: {
        id: { type: 'string', description: 'Ticket ID' },
        agent: { type: 'string', description: 'Your agent name e.g. backend-agent' },
      },
    },
  },
  {
    name: 'taskforce_log_progress',
    description: 'Append a progress/activity log entry to a ticket.',
    inputSchema: {
      type: 'object',
      required: ['id', 'agent', 'message'],
      properties: {
        id: { type: 'string', description: 'Ticket ID' },
        agent: { type: 'string', description: 'Your agent name' },
        message: { type: 'string', description: 'Progress update message' },
        type: { type: 'string', enum: ['update', 'blocked', 'note', 'completed'], default: 'update' },
        details: { type: 'string', description: 'Optional extra details or code snippet' },
      },
    },
  },
  {
    name: 'taskforce_complete_ticket',
    description: 'Mark a ticket as Done and log completion.',
    inputSchema: {
      type: 'object',
      required: ['id', 'agent'],
      properties: {
        id: { type: 'string', description: 'Ticket ID' },
        agent: { type: 'string', description: 'Your agent name' },
        summary: { type: 'string', description: 'What was accomplished' },
      },
    },
  },
  {
    name: 'taskforce_update_ticket',
    description: 'Update any ticket fields (status, assignee, priority, labels).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
        assignee: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        labels: { type: 'array', items: { type: 'string' } },
        logAgent: { type: 'string' },
        logMessage: { type: 'string' },
      },
    },
  },
  {
    name: 'taskforce_get_activity_log',
    description: 'Read the full activity log for a ticket.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Ticket ID' } },
    },
  },
  {
    name: 'taskforce_delete_ticket',
    description: 'Delete a ticket and its activity log.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Ticket ID' } },
    },
  },
];

const server = new Server(
  { name: 'taskforce-ai', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      case 'taskforce_get_dashboard':
        result = await apiCall('/dashboard');
        break;

      case 'taskforce_list_tickets': {
        const data = await apiCall('/tickets');
        let tickets = data.tickets ?? [];
        if (a.status) tickets = tickets.filter((t: { status: string }) => t.status === a.status);
        if (a.label)
          tickets = tickets.filter((t: { labels: string[] }) =>
            t.labels.includes(a.label as string)
          );
        result = { tickets, count: tickets.length };
        break;
      }

      case 'taskforce_create_ticket':
        result = await apiCall('/tickets', 'POST', {
          title: a.title,
          description: a.description ?? '',
          priority: a.priority ?? 'medium',
          labels: a.labels ?? [],
          assignee: a.assignee,
          dependencies: a.dependencies ?? [],
        });
        break;

      case 'taskforce_get_ticket':
        result = await apiCall(`/tickets/${a.id}`);
        break;

      case 'taskforce_claim_ticket':
        result = await apiCall(`/tickets/${a.id}`, 'PUT', {
          status: 'in_progress',
          assignee: a.agent,
          logAgent: a.agent,
        });
        break;

      case 'taskforce_log_progress':
        result = await apiCall(`/tickets/${a.id}/log`, 'POST', {
          agent: a.agent,
          type: a.type ?? 'update',
          message: a.message,
          details: a.details,
        });
        break;

      case 'taskforce_complete_ticket':
        result = await apiCall(`/tickets/${a.id}`, 'PUT', {
          status: 'done',
          logAgent: a.agent,
          logMessage: a.summary ?? 'Task completed.',
          logType: 'completed',
        });
        break;

      case 'taskforce_update_ticket': {
        const { id, ...rest } = a;
        result = await apiCall(`/tickets/${id}`, 'PUT', rest);
        break;
      }

      case 'taskforce_get_activity_log':
        result = await apiCall(`/tickets/${a.id}/log`);
        break;

      case 'taskforce_delete_ticket':
        result = await apiCall(`/tickets/${a.id}`, 'DELETE');
        break;

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${String(err)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TaskForce.AI MCP Server running. Connected to:', BASE_URL);
}

main().catch(console.error);
