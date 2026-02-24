import { NextRequest, NextResponse } from 'next/server';
import { getActivityLog, appendActivityLog, getTicketById } from '@/lib/tickets';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const log = await getActivityLog(id);
    return NextResponse.json({ log });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ticket = await getTicketById(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const body = await req.json();
    const { agent, type = 'update', message, details } = body;
    if (!agent || !message) {
      return NextResponse.json({ error: 'agent and message are required' }, { status: 400 });
    }
    await appendActivityLog(id, agent, type, message, details);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
