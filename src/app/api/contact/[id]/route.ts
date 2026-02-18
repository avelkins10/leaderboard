import { NextRequest, NextResponse } from 'next/server';
import { getContactTimeline } from '@/lib/supabase-queries';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contactId = Number(id);

  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
  }

  try {
    const timeline = await getContactTimeline(contactId);
    return NextResponse.json({ contact_id: contactId, timeline });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
