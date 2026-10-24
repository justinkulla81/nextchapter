import { NextResponse, type NextRequest } from 'next/server'
import { candidateFromAuthHeader } from '@/lib/apply-helper/token'
import { APPLY_HELPER_EVENTS, APPLY_HELPER_SITES } from '@/lib/apply-helper/events'
import { captureServerEvent } from '@/lib/posthog/server'

// Usage events from the extension (filled a form, connected, turned off, ...). Counts and
// the site name only; never field values.
export async function POST(req: NextRequest) {
  const candidateId = candidateFromAuthHeader(req.headers.get('authorization'))
  if (!candidateId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (!b || !APPLY_HELPER_EVENTS.has(b.event)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const props = (b.props ?? {}) as Record<string, unknown>
  captureServerEvent(candidateId, b.event, {
    site: APPLY_HELPER_SITES.has(b.site) ? b.site : 'other',
    fields: typeof props.fields === 'number' ? Math.min(props.fields, 50) : undefined,
    resume: typeof props.resume === 'boolean' ? props.resume : undefined,
    connected: typeof props.connected === 'boolean' ? props.connected : undefined,
    work_history_used: typeof props.work_history_used === 'boolean' ? props.work_history_used : undefined,
  })
  return NextResponse.json({ ok: true })
}
