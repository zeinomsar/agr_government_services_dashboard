import { NextResponse } from 'next/server';
import { correctedRecord, getRecords, saveServiceReview, updateServiceField } from '../../../lib/database';

export const runtime = 'nodejs';

function countsFor(records) {
  return {
    services: records.length,
    pending: records.filter((record) => record.status === 'pending').length,
    saved: records.filter((record) => record.status === 'saved').length,
    edited: records.filter((record) => record.status === 'edited').length,
    flagged: records.filter((record) => record.status === 'flagged').length
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const records = await getRecords();

    if (searchParams.get('format') === 'corrected') {
      return NextResponse.json(records.map(correctedRecord));
    }

    return NextResponse.json({
      databaseReady: true,
      records,
      counts: countsFor(records)
    });
  } catch (error) {
    return NextResponse.json({
      databaseReady: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === 'updateField') {
      const record = await updateServiceField(body.service_id, body.field, body.value);
      return NextResponse.json({ ok: true, record });
    }

    if (body.action === 'saveRecord') {
      const record = await saveServiceReview(body.service_id);
      return NextResponse.json({ ok: true, record });
    }

    return NextResponse.json({
      ok: false,
      error: 'Unsupported action.'
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
}
