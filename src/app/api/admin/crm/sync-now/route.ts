import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { sweepGmail } from '@/lib/crm/sync'
import { captureServerEvent } from '@/lib/posthog/server'

// The scheduled sweep takes ~5 minutes; a page's server action gets 30
// seconds. So this is a route of its own with the cron's budget, called from
// a button rather than run inside a page render.
export const maxDuration = 300

// Hours of mail a manual sweep looks at. Deliberately short: this exists to
// answer "I just sent that, where is it", not to re-do the nightly job. At
// roughly seven messages an hour, six hours is a few dozen messages and a
// few seconds, where the scheduled two-day window is 353 and five minutes.
const MANUAL_WINDOW_HOURS = 6
const MANUAL_MAX_MESSAGES = 150

export async function POST() {
  const admin = await requireAdmin()

  try {
    const result = await sweepGmail(MANUAL_WINDOW_HOURS / 24, MANUAL_MAX_MESSAGES, 'gmail-manual')
    captureServerEvent(admin.email ?? 'admin', 'crm_manual_sync_run', {
      scanned: result.scanned,
      matched: result.matched,
      activitiesCreated: result.activitiesCreated,
      reason: result.reason ?? null,
    })

    if (result.reason === 'no_connection' || result.reason === 'no_token') {
      return NextResponse.json({ ok: false, message: 'Gmail is not connected — reconnect it on Activity sync.' })
    }
    return NextResponse.json({
      ok: true,
      created: result.activitiesCreated,
      scanned: result.scanned,
      windowHours: MANUAL_WINDOW_HOURS,
    })
  } catch (e) {
    // Same rule as saving an address: a third party being slow is not the
    // page's problem to crash over.
    captureServerEvent(admin.email ?? 'admin', 'crm_manual_sync_failed', {
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ ok: false, message: 'Gmail did not answer. Try again in a moment.' })
  }
}
