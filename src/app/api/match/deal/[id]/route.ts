import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { QB_API_TOKEN, QB_REALM, QB_PROJECTS_TABLE } from '@/lib/config';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qbRecordId = Number(id);
  if (isNaN(qbRecordId)) {
    return NextResponse.json({ error: 'Invalid QB record ID' }, { status: 400 });
  }

  try {
    // Get QB deal data
    const qbRes = await fetch('https://api.quickbase.com/v1/records/query', {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': QB_REALM,
        'Authorization': `QB-USER-TOKEN ${QB_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: QB_PROJECTS_TABLE,
        select: [3, 145, 146, 148, 149, 522, 517, 337, 2277, 2279, 13, 543, 339, 189, 255],
        where: `{3.EX.${qbRecordId}}`,
      }),
    });
    if (!qbRes.ok) throw new Error(`QB API error: ${qbRes.status}`);
    const qbData = await qbRes.json();
    const qbRecord = qbData.data?.[0];
    if (!qbRecord) {
      return NextResponse.json({ error: 'QB record not found' }, { status: 404 });
    }

    const qbDeal = {
      record_id: qbRecord['3']?.value,
      customer_name: qbRecord['145']?.value || '',
      customer_address: qbRecord['146']?.value || '',
      mobile_phone: qbRecord['148']?.value || '',
      email: qbRecord['149']?.value || '',
      sale_date: qbRecord['522']?.value || '',
      closer_name: qbRecord['517']?.value || '',
      setter_name: qbRecord['337']?.value || '',
      closer_rc_id: qbRecord['2277']?.value || '',
      setter_rc_id: qbRecord['2279']?.value || '',
      system_size_kw: parseFloat(qbRecord['13']?.value || 0),
      net_ppw: parseFloat(qbRecord['543']?.value || 0),
      sales_office: qbRecord['339']?.value || '',
      state: qbRecord['189']?.value || '',
      status: qbRecord['255']?.value || '',
    };

    // Get deal match
    const { data: matchData } = await supabaseAdmin
      .from('deal_matches')
      .select('*')
      .eq('qb_record_id', qbRecordId)
      .limit(1);
    const match = matchData?.[0] ?? null;

    // Get appointment if matched
    let appointment = null;
    let doorKnocks: any[] = [];
    let statusChanges: any[] = [];
    let attachments: any[] = [];

    if (match?.appointment_id) {
      const { data: apptData } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('id', match.appointment_id)
        .limit(1);
      appointment = apptData?.[0] ?? null;
    }

    const contactId = match?.contact_id ?? appointment?.contact_id;
    if (contactId) {
      const [knockRes, statusRes, attachRes] = await Promise.all([
        supabaseAdmin.from('door_knocks').select('*').eq('contact_id', contactId).order('knocked_at'),
        supabaseAdmin.from('lead_status_changes').select('*').eq('contact_id', contactId).order('changed_at'),
        supabaseAdmin.from('attachments').select('*').eq('contact_id', contactId).order('created_at'),
      ]);
      doorKnocks = knockRes.data || [];
      statusChanges = statusRes.data || [];
      attachments = attachRes.data || [];
    }

    return NextResponse.json({
      qb_deal: qbDeal,
      match,
      appointment,
      door_knocks: doorKnocks,
      status_changes: statusChanges,
      attachments,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
