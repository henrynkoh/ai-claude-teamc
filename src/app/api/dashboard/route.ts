import { NextResponse } from 'next/server';
import { getDashboardStats, getAllTickets } from '@/lib/tickets';

const EMPTY = {
  stats: { total: 0, todo: 0, in_progress: 0, done: 0, lastUpdated: new Date().toISOString(), agents: [] },
  tickets: [],
};

export async function GET() {
  try {
    const [stats, tickets] = await Promise.all([getDashboardStats(), getAllTickets()]);
    return NextResponse.json({ stats, tickets });
  } catch (error) {
    // Return empty board (not a crash) when storage isn't configured yet
    return NextResponse.json({ ...EMPTY, _storageError: String(error) });
  }
}
