import { NextRequest, NextResponse } from 'next/server';
import { getTicketById, updateTicket, deleteTicket, appendActivityLog } from '@/lib/tickets';
import { UpdateTicketPayload } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = getTicketById(id);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ticket: result.ticket });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as UpdateTicketPayload & {
      logAgent?: string;
      logMessage?: string;
      logType?: string;
      logDetails?: string;
    };

    const existing = getTicketById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const ticket = updateTicket(id, body);
    if (!ticket) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    // Auto-log status changes
    if (body.status && body.status !== existing.ticket.status) {
      const agent = body.logAgent ?? body.assignee ?? ticket.assignee ?? 'system';
      if (body.status === 'in_progress') {
        appendActivityLog(id, agent, 'claimed', `Ticket claimed and work started.`, body.logDetails);
      } else if (body.status === 'done') {
        appendActivityLog(id, agent, 'completed', `Ticket marked as done.`, body.logDetails);
      }
    }

    // Custom log entry
    if (body.logMessage) {
      appendActivityLog(
        id,
        body.logAgent ?? ticket.assignee ?? 'system',
        body.logType ?? 'update',
        body.logMessage,
        body.logDetails
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = deleteTicket(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
