'use client';

import { useState, useEffect, useCallback } from 'react';
import { Ticket, DashboardStats } from '@/lib/types';
import DashboardHeader from '@/components/DashboardHeader';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTicketModal from '@/components/CreateTicketModal';
import { Terminal, Zap } from 'lucide-react';

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    todo: 0,
    in_progress: 0,
    done: 0,
    lastUpdated: '',
    agents: [],
  });
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchDashboard = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setTickets(data.tickets ?? []);
      setStats(data.stats ?? {});
    } catch {
      // silent
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
                {`Initialize TaskForce Kanban board and create tickets for: [your project goal]. Then have agents claim and work on them.`}
              </code>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Create first ticket
            </button>
          </div>
        </div>
      ) : (
        <KanbanBoard
          tickets={tickets}
          onRefresh={() => fetchDashboard()}
          onCreateClick={() => setShowCreate(true)}
        />
      )}

      {tickets.length > 0 && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-lg shadow-violet-900/50 flex items-center justify-center transition-all hover:scale-110"
          title="Create ticket"
        >
          <span className="text-2xl font-light leading-none">+</span>
        </button>
      )}

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchDashboard()}
        />
      )}
    </div>
  );
}
