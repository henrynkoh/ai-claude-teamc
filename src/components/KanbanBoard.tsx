'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Ticket, TicketStatus } from '@/lib/types';
import TicketCard from './TicketCard';
import TicketModal from './TicketModal';
import { Circle, Clock, CheckCircle, Plus } from 'lucide-react';

interface Props {
  tickets: Ticket[];
  onRefresh: () => void;
  onCreateClick: () => void;
}

const COLUMNS: { id: TicketStatus; label: string; icon: React.ReactNode; headerColor: string; bgColor: string; borderColor: string }[] = [
  {
    id: 'todo',
    label: 'To Do',
    icon: <Circle className="w-4 h-4 text-gray-400" />,
    headerColor: 'text-gray-300',
    bgColor: 'bg-gray-900',
    borderColor: 'border-gray-700',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    icon: <Clock className="w-4 h-4 text-blue-400" />,
    headerColor: 'text-blue-300',
    bgColor: 'bg-gray-900',
    borderColor: 'border-blue-800',
  },
  {
    id: 'done',
    label: 'Done',
    icon: <CheckCircle className="w-4 h-4 text-green-400" />,
    headerColor: 'text-green-300',
    bgColor: 'bg-gray-900',
    borderColor: 'border-green-800',
  },
];

export default function KanbanBoard({ tickets, onRefresh, onCreateClick }: Props) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const getColumnTickets = (status: TicketStatus) =>
    tickets.filter((t) => t.status === status);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      const { draggableId, destination } = result;
      const newStatus = destination.droppableId as TicketStatus;
      const ticket = tickets.find((t) => t.id === draggableId);
      if (!ticket || ticket.status === newStatus) return;

      await fetch(`/api/tickets/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, logAgent: 'user', logMessage: `Moved to ${newStatus}` }),
      });
      onRefresh();
    },
    [tickets, onRefresh]
  );

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 flex-1 overflow-x-auto px-6 py-4 min-h-0">
          {COLUMNS.map((col) => {
            const colTickets = getColumnTickets(col.id);
            return (
              <div
                key={col.id}
                className={`flex flex-col flex-1 min-w-72 max-w-md rounded-xl border ${col.borderColor} ${col.bgColor} overflow-hidden`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <span className={`font-semibold text-sm ${col.headerColor}`}>{col.label}</span>
                    <span className="bg-gray-800 text-gray-400 text-xs rounded-full px-2 py-0.5 font-mono">
                      {colTickets.length}
                    </span>
                  </div>
                  {col.id === 'todo' && (
                    <button
                      onClick={onCreateClick}
                      className="text-gray-500 hover:text-violet-400 transition-colors"
                      title="Create ticket"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 space-y-2.5 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-gray-800/50' : ''
                      }`}
                      style={{ minHeight: 120 }}
                    >
                      {colTickets.map((ticket, index) => (
                        <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                            >
                              <TicketCard
                                ticket={ticket}
                                onClick={() => setSelectedTicket(ticket)}
                                isDragging={snap.isDragging}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {colTickets.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="text-gray-700 text-sm">
                            {col.id === 'todo' ? (
                              <button
                                onClick={onCreateClick}
                                className="flex flex-col items-center gap-2 group"
                              >
                                <div className="w-10 h-10 border-2 border-dashed border-gray-700 group-hover:border-violet-700 rounded-xl flex items-center justify-center transition-colors">
                                  <Plus className="w-5 h-5 text-gray-600 group-hover:text-violet-500 transition-colors" />
                                </div>
                                <span className="text-gray-600 group-hover:text-gray-400 text-xs transition-colors">
                                  Create a ticket
                                </span>
                              </button>
                            ) : (
                              <span className="text-gray-700 text-xs italic">Drop tickets here</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => {
            setSelectedTicket(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
