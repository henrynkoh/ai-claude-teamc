'use client';

import { useState, useEffect } from 'react';
import { Ticket, TicketStatus, TicketPriority } from '@/lib/types';
import { X, User, Tag, GitBranch, Clock, Send, Trash2, ChevronRight } from 'lucide-react';

interface Props {
  ticket: Ticket;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: () => void;
}

const statusOptions: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'To Do', color: 'bg-gray-700 text-gray-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-900 text-blue-300' },
  { value: 'done', label: 'Done', color: 'bg-green-900 text-green-300' },
];

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function TicketModal({ ticket, onClose, onUpdated, onDeleted }: Props) {
  const [activityLog, setActivityLog] = useState('');
  const [logMessage, setLogMessage] = useState('');
  const [logAgent, setLogAgent] = useState('');
  const [logType, setLogType] = useState('update');
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [assignee, setAssignee] = useState(ticket.assignee ?? '');
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/tickets/${ticket.id}/log`)
      .then((r) => r.json())
      .then((d) => setActivityLog(d.log ?? ''));
  }, [ticket.id]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          assignee: assignee || null,
          priority,
          logAgent: logAgent || assignee || 'user',
        }),
      });
      onUpdated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = async () => {
    if (!logMessage.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/tickets/${ticket.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: logAgent || 'user',
          type: logType,
          message: logMessage.trim(),
        }),
      });
      const res = await fetch(`/api/tickets/${ticket.id}/log`);
      const data = await res.json();
      setActivityLog(data.log ?? '');
      setLogMessage('');
      onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
      onDeleted ? onDeleted() : onUpdated();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const formatLogMarkdown = (md: string) => {
    return md
      .split('\n')
      .map((line) => {
        if (line.startsWith('## ')) return `<div class="text-sm font-semibold text-gray-300 mt-3 mb-1">${line.slice(3)}</div>`;
        if (line.startsWith('**') && line.endsWith('**')) return `<div class="text-xs text-gray-400 font-medium">${line.slice(2, -2)}</div>`;
        if (line.startsWith('**') && line.includes(':**'))
          return `<div class="text-xs text-gray-400">${line.replace(/\*\*(.+?)\*\*/g, '<span class="text-gray-300 font-medium">$1</span>')}</div>`;
        if (line === '---') return `<hr class="border-gray-700 my-2"/>`;
        if (line === '') return `<div class="h-1"/>`;
        return `<div class="text-xs text-gray-400">${line}</div>`;
      })
      .join('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-500 text-xs font-mono">{ticket.id}</span>
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <span className="text-gray-400 text-xs">Ticket Detail</span>
            </div>
            <h2 className="text-white font-semibold text-base leading-snug">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: details + controls */}
          <div className="w-56 shrink-0 border-r border-gray-800 p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="text-gray-500 text-xs font-medium mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500"
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-500 text-xs font-medium mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3" /> Assignee
              </label>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="agent-name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="text-gray-500 text-xs font-medium mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500"
              >
                {priorityOptions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {ticket.labels.length > 0 && (
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Labels
                </label>
                <div className="flex flex-wrap gap-1">
                  {ticket.labels.map((l) => (
                    <span key={l} className="bg-violet-900 text-violet-300 border border-violet-700 text-xs px-1.5 py-0.5 rounded">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ticket.dependencies.length > 0 && (
              <div>
                <label className="text-gray-500 text-xs font-medium mb-1.5 flex items-center gap-1">
                  <GitBranch className="w-3 h-3" /> Depends on
                </label>
                <div className="space-y-1">
                  {ticket.dependencies.map((d) => (
                    <span key={d} className="block text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-gray-600 text-xs space-y-1 pt-2 border-t border-gray-800">
              <div>Created: {new Date(ticket.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(ticket.updated_at).toLocaleString()}</div>
            </div>

            <button
              onClick={handleUpdate}
              disabled={loading}
              className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-red-400 text-xs text-center">Sure?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs"
                  >Cancel</button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg text-xs"
                  >{deleting ? '...' : 'Delete'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: description + activity log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {ticket.description && (
              <div className="px-4 py-3 border-b border-gray-800 shrink-0">
                <p className="text-gray-400 text-xs font-medium mb-1">Description</p>
                <p className="text-gray-300 text-sm leading-relaxed">{ticket.description}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-gray-500 text-xs font-medium mb-2">Activity Log</p>
              {activityLog ? (
                <div
                  className="space-y-0.5"
                  dangerouslySetInnerHTML={{ __html: formatLogMarkdown(activityLog) }}
                />
              ) : (
                <div className="text-gray-600 text-xs italic">No activity yet.</div>
              )}
            </div>

            {/* Add log entry */}
            <div className="border-t border-gray-800 p-3 shrink-0">
              <div className="flex gap-2 mb-2">
                <input
                  value={logAgent}
                  onChange={(e) => setLogAgent(e.target.value)}
                  placeholder="Agent name"
                  className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  <option value="update">Update</option>
                  <option value="claimed">Claimed</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  value={logMessage}
                  onChange={(e) => setLogMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
                  placeholder="Add activity log entry..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleAddLog}
                  disabled={loading || !logMessage.trim()}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
