import { NextRequest, NextResponse } from 'next/server';
import { getAllTickets, createTicket } from '@/lib/tickets';
import { CreateTicketPayload } from '@/lib/types';

export async function GET() {
  try {
    const tickets = await getAllTickets();
    return NextResponse.json({ tickets });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateTicketPayload;
    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const ticket = await createTicket({
      title: body.title,
      description: body.description ?? '',
      priority: body.priority ?? 'medium',
      labels: body.labels ?? [],
      dependencies: body.dependencies ?? [],
      assignee: body.assignee ?? null,
      status: 'todo',
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
