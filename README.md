# TaskForce.AI

> Persistent Kanban PM dashboard for Claude Agent Teams
> Inspired by the "데이터가 답이다" YouTube channel (Feb 2026)

## What is this?

A Next.js web app that replaces volatile terminal logs with a structured, file-based Kanban board for managing multiple Claude agents working in parallel.

```
Agent Terminal                    TaskForce.AI Dashboard (localhost:3000)
─────────────────                 ──────────────────────────────────────
backend-agent: working...    →    [ticket-001] Build API  → backend-agent  [In Progress]
frontend-agent: styling...   →    [ticket-002] Style UI   → frontend-agent [In Progress]
test-agent: writing tests... →    [ticket-003] Write Tests → test-agent    [In Progress]
```

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Architecture

```
taskforce-ai/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Kanban board UI (auto-refreshes every 5s)
│   │   └── api/
│   │       ├── tickets/          # CRUD for tickets
│   │       │   └── [id]/log/     # Activity log per ticket
│   │       └── dashboard/        # Stats + all tickets
│   ├── components/
│   │   ├── KanbanBoard.tsx       # Drag-and-drop Kanban
│   │   ├── TicketCard.tsx        # Ticket card
│   │   ├── TicketModal.tsx       # Detail view + log viewer
│   │   ├── CreateTicketModal.tsx # Create ticket form
│   │   └── DashboardHeader.tsx   # Stats bar
│   └── lib/
│       ├── types.ts              # TypeScript types
│       └── tickets.ts            # File system operations
├── taskforce_kanban/             # Persisted on disk (git-tracked)
│   ├── todo/                     # Pending ticket JSON files
│   ├── in_progress/              # Active ticket JSON files
│   ├── done/                     # Completed ticket JSON files
│   ├── logs/                     # Per-ticket activity logs (markdown)
│   └── taskforce_dashboard.md    # Human-readable dashboard snapshot
└── mcp-server/
    └── server.ts                 # MCP server for Claude Code integration
```

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Stats + all tickets |
| GET | `/api/tickets` | List all tickets |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |
| GET | `/api/tickets/:id/log` | Read activity log |
| POST | `/api/tickets/:id/log` | Append log entry |

### Create a ticket

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Build API endpoint","priority":"high","labels":["backend","api"]}'
```

### Claim + log + complete

```bash
# Claim
curl -X PUT http://localhost:3000/api/tickets/ticket-001 \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress","assignee":"backend-agent"}'

# Log progress
curl -X POST http://localhost:3000/api/tickets/ticket-001/log \
  -H "Content-Type: application/json" \
  -d '{"agent":"backend-agent","type":"update","message":"Endpoint implemented"}'

# Complete
curl -X PUT http://localhost:3000/api/tickets/ticket-001 \
  -H "Content-Type: application/json" \
  -d '{"status":"done","logAgent":"backend-agent","logMessage":"Done!"}'
```

## MCP Server

Run alongside the dashboard to give Claude Code native tool access:

```bash
npm run mcp
```

Add to `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "taskforce-ai": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/taskforce-ai"
    }
  }
}
```

MCP tools available: `taskforce_get_dashboard`, `taskforce_list_tickets`, `taskforce_create_ticket`, `taskforce_claim_ticket`, `taskforce_log_progress`, `taskforce_complete_ticket`, `taskforce_update_ticket`, `taskforce_get_activity_log`, `taskforce_delete_ticket`

## Kick-off Prompt for Claude Agent Teams

```
Using the TaskForce Kanban skill, coordinate a multi-agent team to: [YOUR GOAL]

1. Check the board: GET http://localhost:3000/api/dashboard
2. Create 8-12 tickets via POST /api/tickets (labels: backend, frontend, test...)
3. Sub-agents claim tickets and log progress as they work
4. Move tickets to done when complete
5. The human is watching at http://localhost:3000 — update frequently!
```

## Features

- Kanban board: To Do / In Progress / Done columns
- Drag-and-drop between columns
- Ticket detail modal with activity log viewer
- Per-ticket markdown activity log (git-tracked)
- Auto-refresh every 5 seconds
- Dashboard stats (total, by status, active agents)
- REST API for agent curl calls
- MCP server for native Claude Code tool calls
- All data persists as JSON + markdown files on disk
