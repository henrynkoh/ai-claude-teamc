import { NextResponse } from 'next/server';
import { getDashboardStats, getAllTickets } from '@/lib/tickets';

export async function GET() {
  try {
    const stats = getDashboardStats();
    const tickets = getAllTickets();
    return NextResponse.json({ stats, tickets });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
