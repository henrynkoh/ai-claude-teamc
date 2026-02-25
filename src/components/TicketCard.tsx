'use client';

import { useState } from 'react';
import { Ticket } from '@/lib/types';
import { User, AlertCircle, ChevronRight, Zap } from 'lucide-react';

interface Props {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
  onQuickClaim: (ticket: Ticket, agent: string) => void;
}

const priorityConfig = {
  high:   { dot: 'bg-red-500',    label: 'High', badge: 'bg-red-950 border-red-800 text-red-400' },
  medium: { dot: 'bg-yellow-500', label: 'Med',  badge: 'bg-yellow-950 border-yellow-800 text-yellow-400' },
  low:    { dot: 'bg-gray-500',   label: 'Low',  badge: 'bg-gray-800 border-gray-700 text-gray-400' },
};

const labelColors = [
  'bg-violet-900 text-violet-300 border-violet-700',
  'bg-blue-900 text-blue-300 border-blue-700',
  'bg-cyan-900 text-cyan-300 border-cyan-700',
  'bg-teal-900 text-teal-300 border-teal-700',
  'bg-pink-900 text-pink-300 border-pink-700',
];

// Consistent color per agent name
const agentColors = ['text-violet-400', 'text-blue-400', 'text-cyan-400', 'text-teal-400', 'text-pink-400', 'text-orange-400'];
function agentColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return agentColors[Math.abs(h) % agentColors.length];
}

export default function TicketCard({ ticket, onClick, isDragging, onQuickClaim }: Props) {
  const [showClaim, setShowClaim] = useState(false);
  const [claimName, setClaimName] = useState('');
  const p = priorityConfig[ticket.priority];

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = claimName.trim() || 'agent';
    onQuickClaim(ticket, name);
    setShowClaim(false);
    setClaimName('');
  };

  return (
    <div
      onClick={onClick}
      className={`group bg-gray-800 border border-gray-700 rounded-xl p-3.5 cursor-pointer
        hover:border-gray-500 transition-all duration-150
        ${isDragging ? 'opacity-50 scale-95 rotate-1 shadow-2xl' : ''}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 text-xs font-mono">{ticket.id}</span>
          <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${p.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            {p.label}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors" />
      </div>

      {/* Title */}
      <p className="text-white text-sm font-medium leading-snug mb-2 line-clamp-2">{ticket.title}</p>

      {/* Description */}
      {ticket.description && (
        <p className="text-gray-400 text-xs leading-relaxed mb-2.5 line-clamp-2">{ticket.description}</p>
      )}

      {/* Labels + assignee */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {ticket.labels.slice(0, 3).map((label, i) => (
            <span key={label} className={`text-xs px-1.5 py-0.5 rounded border font-medium ${labelColors[i % labelColors.length]}`}>
              {label}
            </span>
          ))}
          {ticket.labels.length > 3 && <span className="text-xs text-gray-500">+{ticket.labels.length - 3}</span>}
        </div>

        {ticket.assignee ? (
          <div className={`flex items-center gap-1 text-xs ${agentColor(ticket.assignee)}`}>
            <User className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{ticket.assignee}</span>
          </div>
        ) : ticket.status === 'todo' ? (
          <div onClick={(e) => e.stopPropagation()}>
            {!showClaim ? (
              <button
                onClick={(e) => { e.stopPropagation(); setShowClaim(true); }}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-violet-400 transition-colors"
                title="Quick claim"
              >
                <Zap className="w-3 h-3" />
                <span>Claim</span>
              </button>
            ) : (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleClaim(e as unknown as React.MouseEvent); if (e.key === 'Escape') setShowClaim(false); }}
                  placeholder="agent name"
                  className="w-20 bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
                <button onClick={handleClaim} className="text-xs text-violet-400 hover:text-violet-300 font-medium">Go</button>
                <button onClick={(e) => { e.stopPropagation(); setShowClaim(false); }} className="text-xs text-gray-600 hover:text-gray-400">✕</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-600 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>Unassigned</span>
          </div>
        )}
      </div>

      {ticket.dependencies.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <span className="text-gray-600 text-xs">Depends: {ticket.dependencies.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
