import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { sweepGmail } from '@/lib/crm/sync'
import { captureServerEvent } from '@/lib/posthog/server'

// The same budget as the scheduled sweep: a page's server action gets 30
// seconds, and this can need more on a busy day.
export const maxDuration = 300

const HOUR = 3_600_000
// Never less than this, so a click right after a sweep still re-checks the
// last few hours; never more, so a long gap can't turn one click into a
// full historical backfill.
const MIN_WINDOW_HOURS = 6
const MAX_WINDOW_HOURS = 48
const MAX_MESSAGES = 400

/**
 * Pulls everything since the last sweep that actually finished.
 *
 * It used to look back a fixed six hours, so anything older than that and
 * newer than the last daily sweep fell in a gap no one covered — two emails
 * to one contact at 4:34 and 4:44 were invisible to a click at 11:27. Now
 * the window starts at the last finished sweep (scheduled or manual), less an
 * hour of overlap; re-reading a message is harmless because writes upsert on
 * the message id.
 */
export async function POST() {
  const admin = await requireAdmin()

  const last = await prisma.crmSyncRun.findFirst({
    where: { finishedAt: { not: null }, error: null, source: { in: ['gmail', 'gmail-manual'] } },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  })
  const sinceLast = last ? (Date.now() - last.startedAt.getTime()) / HOUR + 1 : MAX_WINDOW_HOURS
  const windowHours = Math.min(MAX_WINDOW_HOURS, Math.max(MIN_WINDOW_HOURS, Math.ceil(sinceLast)))

  try {
    const result = await sweepGmail(windowHours / 24, MAX_MESSAGES, 'gmail-manual')
    captureServerEvent(admin.email ?? 'admin', 'crm_manual_sync_run', {
      windowHours, scanned: result.scanned, matched: result.matched,
      activitiesCreated: result.activitiesCreated, reason: result.reason ?? null,
    })
    if (result.reason === 'no_connection' || result.reason === 'no_token') {
      return NextResponse.json({ ok: false, message: 'Gmail is not connected — reconnect it on Activity sync.' })
    }
    return NextResponse.json({
      ok: true, created: result.activitiesCreated, scanned: result.scanned, windowHours,
      failed: result.failed ?? 0,
    })
  } catch (e) {
    // A third party being slow is not the page's problem to crash over.
    const error = e instanceof Error ? e.message : String(e)
    captureServerEvent(admin.email ?? 'admin', 'crm_manual_sync_failed', { error })
    // Google expires the refresh token every 7 days while the OAuth app is in
    // testing mode — retrying can never fix that, so don't say "try again".
    if (error.includes('invalid_grant')) {
      return NextResponse.json({ ok: false, message: 'Gmail access expired — reconnect it on Activity sync.' })
    }
    return NextResponse.json({ ok: false, message: 'Gmail did not answer. Try again in a moment.' })
  }
}
