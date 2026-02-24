'use client';

import { DashboardStats } from '@/lib/types';
import { Activity, CheckCircle, Circle, Clock, Users, RefreshCw } from 'lucide-react';

interface Props {
  stats: DashboardStats;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function DashboardHeader({ stats, onRefresh, refreshing }: Props) {
  const completionRate =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">TaskForce.AI</h1>
            <p className="text-gray-400 text-xs">Claude Agent Teams — Kanban PM Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats.lastUpdated && (
            <span className="text-gray-500 text-xs">
              Updated {new Date(stats.lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Circle className="w-4 h-4 text-gray-400" />}
          label="To Do"
          value={stats.todo}
          color="text-gray-400"
          bg="bg-gray-800"
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-blue-400" />}
          label="In Progress"
          value={stats.in_progress}
          color="text-blue-400"
          bg="bg-blue-950"
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4 text-green-400" />}
          label="Done"
          value={stats.done}
          color="text-green-400"
          bg="bg-green-950"
        />
        <StatCard
          icon={<Users className="w-4 h-4 text-violet-400" />}
          label="Agents"
          value={stats.agents.length}
          color="text-violet-400"
          bg="bg-violet-950"
          sub={`${completionRate}% complete`}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 border border-gray-700/50`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-gray-400 text-xs font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}
