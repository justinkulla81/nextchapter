import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sweepGmail, sweepCalendar } from '@/lib/crm/sync'

export const maxDuration = 300

/**
 * Nightly CRM activity sync.
 *
 * Runs the two sweeps independently: a Gmail failure must not cost the
 * calendar's results, since the calendar is often the more accurate
 * last-contacted signal for anyone you've actually met.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The cron fires hourly; the SETTING decides whether a sweep is actually
  // due. Putting the schedule in the database rather than in vercel.json makes
  // changing it a setting rather than a deploy.
  const force = request.nextUrl.searchParams.get('force') === '1'
  const setting = await prisma.crmSyncSetting.findUnique({ where: { id: 'singleton' } })
  const intervalHours = setting?.intervalHours ?? 24
  const enabled = setting?.enabled ?? true

  if (!enabled && !force) {
    return NextResponse.json({ skipped: 'sync_disabled' })
  }
  if (!force) {
    const last = await prisma.crmSyncRun.findFirst({
      where: { finishedAt: { not: null } }, orderBy: { startedAt: 'desc' }, select: { startedAt: true },
    })
    if (last) {
      const dueAt = last.startedAt.getTime() + intervalHours * 3_600_000
      // A little slack, so an hourly cron landing a few seconds early does not
      // push the next sweep a whole interval away.
      if (Date.now() < dueAt - 120_000) {
        return NextResponse.json({
          skipped: 'not_due', intervalHours,
          nextDueAt: new Date(dueAt).toISOString(),
        })
      }
    }
  }

  // Look back far enough to cover the whole interval plus a margin, so nothing
  // falls between two sweeps.
  const days = Number(request.nextUrl.searchParams.get('days') ?? String(Math.max(2, Math.ceil(intervalHours / 24) + 1)))
  const results: Record<string, unknown> = { intervalHours, windowDays: days }

  try {
    results.gmail = await sweepGmail(days)
  } catch (e) {
    results.gmail = { error: e instanceof Error ? e.message : String(e) }
  }

  try {
    results.calendar = await sweepCalendar(days)
  } catch (e) {
    results.calendar = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(results)
}
