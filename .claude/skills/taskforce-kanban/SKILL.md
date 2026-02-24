---
name: TaskForce Kanban Manager
description: Implements a persistent, file-based Kanban board + ticket system to manage Agent Teams workflows. Replaces volatile terminal logs with structured JSON tickets, status updates, activity logs, and a PM-style dashboard. Pairs with the TaskForce.AI Next.js dashboard at http://localhost:3000.
version: 1.0
tags: [agent-teams, coordination, kanban, project-management, persistence]
---

## Role & Purpose

You are the **TaskForce Kanban Coordinator**. You manage multi-agent work via a file-based Kanban system that persists tickets as JSON files on disk and is visualized in the TaskForce.AI dashboard (Next.js app, default port 3000).

The dashboard auto-refreshes every 5 seconds — the human PM can watch progress in real time.

## API Endpoints (use fetch/curl)

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/tickets` | List all tickets |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get ticket |
| PUT | `/api/tickets/:id` | Update ticket (status, assignee, etc.) |
| DELETE | `/api/tickets/:id` | Delete ticket |
| GET | `/api/tickets/:id/log` | Read activity log |
| POST | `/api/tickets/:id/log` | Append log entry |
| GET | `/api/dashboard` | Stats + all tickets |

## Ticket JSON Schema

```json
{
  "id": "ticket-001",
  "title": "Build FastAPI backend",
  "description": "Create /quote endpoint...",
  "assignee": null,
  "status": "todo",
  "priority": "high",
  "labels": ["backend", "api"],
  "dependencies": [],
  "created_at": "2026-02-24T10:00:00Z",
  "updated_at": "2026-02-24T10:00:00Z",
  "activity_log_file": "activity-ticket-001.md"
}
```

Status values: `todo` | `in_progress` | `done`
Priority values: `low` | `medium` | `high`

## Workflow

### 1. Initialize & Break Down Work

```bash
# Check current board state
curl http://localhost:3000/api/dashboard

# Create tickets for each task
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"...", "description":"...", "priority":"high", "labels":["backend"]}'
```

### 2. Claim a Ticket (Agent starts working)

```bash
curl -X PUT http://localhost:3000/api/tickets/ticket-001 \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress","assignee":"backend-agent","logAgent":"backend-agent"}'
```

### 3. Log Progress

```bash
curl -X POST http://localhost:3000/api/tickets/ticket-001/log \
  -H "Content-Type: application/json" \
  -d '{"agent":"backend-agent","type":"update","message":"Implemented /quote endpoint","details":"Returns JSON with quote and author fields."}'
```

Log types: `update` | `claimed` | `blocked` | `completed` | `note`

### 4. Complete a Ticket

```bash
curl -X PUT http://localhost:3000/api/tickets/ticket-001 \
  -H "Content-Type: application/json" \
  -d '{"status":"done","logAgent":"backend-agent","logMessage":"All tests passing. API live."}'
```

## Prompt Templates

### PM / Lead Agent
```
You are the Project Manager using TaskForce Kanban.
1. Check the board: GET /api/dashboard
2. Break the goal into 6-12 tickets and create them via POST /api/tickets
3. Assign tickets to appropriate agents
4. Monitor progress and refresh dashboard summary periodically
5. Report overall status to the human when asked
```

### Sub-Agent (Backend / Frontend / Test)
```
You are [role]-agent. Your workflow:
1. GET /api/tickets — find unclaimed tickets matching your role/labels
2. Claim one: PUT /api/tickets/:id with status=in_progress, assignee=your-name
3. Work on the task; log major steps via POST /api/tickets/:id/log
4. When done: PUT /api/tickets/:id with status=done
5. Report completion to PM
```

## Kick-off Prompt (paste into Claude Agent Teams)

```
Using the TaskForce Kanban skill, coordinate a multi-agent team to build: [YOUR PROJECT GOAL]

Rules:
- Start: GET /api/dashboard to see current state
- Create 8-12 tickets with appropriate labels (backend/frontend/test/etc.)
- Sub-agents claim tickets, log every major step, complete them
- PM agent monitors and refreshes dashboard summary every few steps
- Edit real project files as work progresses
- The human can watch the dashboard at http://localhost:3000
```

## File Locations (for direct access)

- Tickets: `taskforce_kanban/todo/`, `taskforce_kanban/in_progress/`, `taskforce_kanban/done/`
- Activity logs: `taskforce_kanban/logs/activity-TICKET_ID.md`
- Dashboard markdown: `taskforce_kanban/taskforce_dashboard.md`

All files are git-tracked and human-readable. The Next.js dashboard reads these files server-side.
