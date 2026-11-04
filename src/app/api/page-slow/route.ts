import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { mirrorServerEvent } from '@/lib/posthog/server'

export const maxDuration = 15

const EVENTS = new Set(['page_load_slow', 'page_load_stalled', 'page_load_finished'])

// The loading watcher (components/perf/LoadingWatch) beacons here when a member has waited 4 s or more for a page, so the slow-page
// alert (lib/perf/slow-alert) can count it from our own database. Always answers 204; capped per network; stores only the page, the wait and the
// browser's anonymous id.
export async function POST(request: NextRequest) {
  if (!(await allowByIp('page-slow', 120, HOUR_MS))) return new NextResponse(null, { status: 204 })
  const text = await request.text().catch(() => '')
  if (!text || text.length > 1024) return new NextResponse(null, { status: 204 })
  try {
    const body = JSON.parse(text) as Record<string, unknown>
    const event = typeof body.event === 'string' ? body.event : ''
    const waitedMs = typeof body.waitedMs === 'number' && Number.isFinite(body.waitedMs) ? Math.min(Math.round(body.waitedMs), 3_600_000) : null
    if (!EVENTS.has(event) || waitedMs === null) return new NextResponse(null, { status: 204 })
    const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null
    const who = typeof body.who === 'string' && body.who ? body.who.slice(0, 80) : 'anonymous'
    mirrorServerEvent(who, event, { path, waitedMs })
  } catch {
    // Not valid JSON; ignore.
  }
  return new NextResponse(null, { status: 204 })
}
