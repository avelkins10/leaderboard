import { NextRequest, NextResponse } from 'next/server';
import { getContactTimeline } from '@/lib/supabase-queries';
import { supabaseAdmin } from '@/lib/supabase';
import { getTimezoneForTeam } from '@/lib/config';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contactId = Number(id);

  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
  }

  try {
    const [timeline, apptResult] = await Promise.all([
      getContactTimeline(contactId),
      supabaseAdmin
        .from('appointments')
        .select('office_team')
        .eq('contact_id', contactId)
        .not('office_team', 'is', null)
        .limit(1)
        .single(),
    ]);

    const timezone = apptResult.data?.office_team
      ? getTimezoneForTeam(apptResult.data.office_team)
      : 'America/New_York';

    return NextResponse.json({ contact_id: contactId, timeline, timezone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
