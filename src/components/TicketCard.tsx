'use client';

import { Ticket } from '@/lib/types';
import { User, AlertCircle, ChevronRight } from 'lucide-react';

interface Props {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
}

const priorityConfig = {
  high: { color: 'text-red-400', bg: 'bg-red-950 border-red-800', dot: 'bg-red-500', label: 'High' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800', dot: 'bg-yellow-500', label: 'Med' },
  low: { color: 'text-gray-400', bg: 'bg-gray-800 border-gray-700', dot: 'bg-gray-500', label: 'Low' },
};

const labelColors = [
  'bg-violet-900 text-violet-300 border-violet-700',
  'bg-blue-900 text-blue-300 border-blue-700',
  'bg-cyan-900 text-cyan-300 border-cyan-700',
  'bg-teal-900 text-teal-300 border-teal-700',
  'bg-pink-900 text-pink-300 border-pink-700',
];

export default function TicketCard({ ticket, onClick, isDragging }: Props) {
  const priority = priorityConfig[ticket.priority];

  return (
    <div
      onClick={onClick}
      className={`
        group bg-gray-800 border border-gray-700 rounded-xl p-3.5 cursor-pointer
        hover:border-gray-500 hover:bg-gray-750 transition-all duration-150
        ${isDragging ? 'opacity-50 scale-95 rotate-1' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs font-mono">{ticket.id}</span>
          <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${priority.bg} ${priority.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors" />
      </div>

      <p className="text-white text-sm font-medium leading-snug mb-2 line-clamp-2">
        {ticket.title}
      </p>

      {ticket.description && (
        <p className="text-gray-400 text-xs leading-relaxed mb-2.5 line-clamp-2">
          {ticket.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {ticket.labels.slice(0, 3).map((label, i) => (
            <span
              key={label}
              className={`text-xs px-1.5 py-0.5 rounded border font-medium ${labelColors[i % labelColors.length]}`}
            >
              {label}
            </span>
          ))}
          {ticket.labels.length > 3 && (
            <span className="text-xs text-gray-500">+{ticket.labels.length - 3}</span>
          )}
        </div>

        {ticket.assignee ? (
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <User className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{ticket.assignee}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-600 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>Unclaimed</span>
          </div>
        )}
      </div>

      {ticket.dependencies.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <span className="text-gray-500 text-xs">
            Depends on: {ticket.dependencies.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
