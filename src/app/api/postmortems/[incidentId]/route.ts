import { NextRequest, NextResponse } from 'next/server';
import { getIncidentById, getPostmortemByIncidentId, insertPostmortem, updatePostmortem } from '@/lib/db';
import { generatePostmortemMarkdown } from '@/lib/postmortem';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { incidentId: string } }) {
  const id = parseInt(params.incidentId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const incident = getIncidentById(id);
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

    let pm = getPostmortemByIncidentId(id);
    if (!pm) {
      const content = generatePostmortemMarkdown(incident);
      const pmId = `pm_${id}_${Date.now()}`;
      insertPostmortem({ id: pmId, incidentDbId: id, content });
      pm = getPostmortemByIncidentId(id);
    }

    return NextResponse.json({ postmortem: pm, incident });
  } catch (err) {
    console.error('[api/postmortems] GET failed:', err);
    return NextResponse.json({ error: 'Failed to fetch postmortem' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { incidentId: string } }) {
  const id = parseInt(params.incidentId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = typeof (body as { content?: unknown }).content === 'string'
    ? (body as { content: string }).content
    : null;
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  try {
    const pm = getPostmortemByIncidentId(id);
    if (!pm) return NextResponse.json({ error: 'Postmortem not found' }, { status: 404 });
    updatePostmortem(pm.id, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/postmortems] PUT failed:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
