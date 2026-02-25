'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Ticket, DashboardStats } from '@/lib/types';
import DashboardHeader from '@/components/DashboardHeader';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTicketModal from '@/components/CreateTicketModal';
import ToastContainer from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Terminal, Zap, AlertTriangle, Search, X } from 'lucide-react';

const EMPTY_STATS: DashboardStats = {
  total: 0, todo: 0, in_progress: 0, done: 0, lastUpdated: '', agents: [],
};

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [search, setSearch] = useState('');
  const { toasts, toast, dismiss } = useToast();

  const fetchDashboard = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setStats(data.stats ?? EMPTY_STATS);
      setStorageError(!!data._storageError);
    } catch {
      // keep existing state
    } finally {
      if (showSpinner) setRefreshing(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(), 5000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(
      (t) =>
        t.id.includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.labels.some((l) => l.toLowerCase().includes(q)) ||
        (t.assignee ?? '').toLowerCase().includes(q)
    );
  }, [tickets, search]);

  const handleCreated = useCallback(() => {
    fetchDashboard();
    toast('Ticket created', 'success');
  }, [fetchDashboard, toast]);

  const handleUpdated = useCallback(() => {
    fetchDashboard();
    toast('Ticket updated', 'success');
  }, [fetchDashboard, toast]);

  const handleDeleted = useCallback(() => {
    fetchDashboard();
    toast('Ticket deleted', 'info');
  }, [fetchDashboard, toast]);

  if (initialLoad) {
    return (
      <div className="flex h-screen bg-gray-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-400 text-sm">Loading TaskForce.AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <DashboardHeader
        stats={stats}
        onRefresh={() => fetchDashboard(true)}
        refreshing={refreshing}
      />

      {storageError && (
        <div className="mx-4 mt-3 flex items-start gap-3 bg-amber-950 border border-amber-700 rounded-xl px-4 py-3 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300 leading-relaxed">
            <span className="font-semibold">Storage not connected.</span>{' '}
            Go to <span className="font-mono text-amber-200">vercel.com → taskforce-ai → Storage</span>
            {' '}→ Add Upstash Redis → Link to project.
          </p>
        </div>
      )}

      {/* Search bar */}
      {tickets.length > 0 && (
        <div className="px-6 pt-3 shrink-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tickets by title, label, agent…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-8 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {search && (
            <p className="text-gray-500 text-xs mt-1">
              {filteredTickets.length} of {tickets.length} tickets
            </p>
          )}
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-16 h-16 bg-gray-800 border-2 border-dashed border-gray-700 rounded-2xl flex items-center justify-center">
              <Terminal className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-xl mb-2">No tickets yet</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Start a multi-agent Claude session and ask it to initialize the TaskForce Kanban
                board, or create your first ticket manually.
              </p>
            </div>
            <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
              <p className="text-gray-500 text-xs font-medium mb-2">Kick-off prompt for Claude:</p>
              <code className="text-green-400 text-xs leading-relaxed block">
                Initialize TaskForce Kanban and create tickets for: [your goal]. Have agents claim and work on them.
              </code>
            </div>
            {!storageError && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Create first ticket
              </button>
            )}
          </div>
        </div>
      ) : (
        <KanbanBoard
          tickets={filteredTickets}
          onRefresh={fetchDashboard}
          onCreateClick={() => setShowCreate(true)}
          onTicketUpdated={handleUpdated}
          onTicketDeleted={handleDeleted}
          onToast={toast}
        />
      )}

      {tickets.length > 0 && !storageError && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-lg shadow-violet-900/50 flex items-center justify-center transition-all hover:scale-110 z-40"
          title="Create ticket (N)"
        >
          <span className="text-2xl font-light leading-none">+</span>
        </button>
      )}

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
