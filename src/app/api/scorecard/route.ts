import { NextRequest, NextResponse } from 'next/server';
import { fetchScorecard, getMonday, getToday } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || getMonday();
  const toDate = searchParams.get('to') || getToday();

  try {
    const result = await fetchScorecard(fromDate, toDate);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
