import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CAMPAIGN } from './plan'
import { queueOutreachForNotice } from './for-notice'
import { outreachEnabled } from './queue'

/** Owner decision 2026-11-13: smaller layoffs get outreach too. 50 is the smallest layoff a WARN filing reports. */
export const OUTREACH_MIN_EMPLOYEES = 50
/** Wait this long after a notice is filed so the contact lookups (HR, board, centers) have had time to fill in. */
export const OUTREACH_MIN_AGE_HOURS = 3
const MAX_AGE_DAYS = 5
const READ_LIMIT = 60
const QUEUE_LIMIT = 12

/**
 * Notices the sweep considers: US, 50+ jobs, filed between 3 hours and 5 days ago, not dismissed, not yet looked at, and not a
 * layoff whose full alert is still being held (the alert path emails those when it sends). Pure, so the filter is tested.
 */
export function sweepWhere(now: Date): Prisma.WarnNoticeWhereInput {
  return {
    outreachCheckedAt: null,
    dismissedAt: null,
    employees: { gte: OUTREACH_MIN_EMPLOYEES },
    fetchedAt: { gte: new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000), lte: new Date(now.getTime() - OUTREACH_MIN_AGE_HOURS * 3_600_000) },
    OR: [{ country: null }, { country: 'US' }],
    NOT: { alertHeldAt: { not: null }, alertSentAt: null, alertGaveUpAt: null },
  }
}

export interface SweepResult { looked: number; queued: number; editions: number; recipients: number; skipped: Record<string, number> }

export async function runOutreachSweep(now = new Date()): Promise<SweepResult> {
  const out: SweepResult = { looked: 0, queued: 0, editions: 0, recipients: 0, skipped: {} }
  if (!outreachEnabled()) { out.skipped['switched off'] = 1; return out }
  const notices = await prisma.warnNotice.findMany({ where: sweepWhere(now), orderBy: { fetchedAt: 'asc' }, take: READ_LIMIT, select: { id: true } })
  if (notices.length === 0) return out
  const done = new Set((await prisma.mailingEdition.findMany({ where: { campaign: CAMPAIGN, warnNoticeId: { in: notices.map((n) => n.id) } }, select: { warnNoticeId: true } })).map((e) => e.warnNoticeId))
  // A layoff the alert path already emailed is finished; mark it so it is not read again.
  const already = notices.filter((n) => done.has(n.id)).map((n) => n.id)
  if (already.length) await prisma.warnNotice.updateMany({ where: { id: { in: already } }, data: { outreachCheckedAt: now } })
  for (const n of notices.filter((x) => !done.has(x.id)).slice(0, QUEUE_LIMIT)) {
    out.looked++
    const r = await queueOutreachForNotice(n.id)
    // One look each: a layoff with nobody to email is not retried every hour. A failure ('error') is retried next run.
    if (r.skipped !== 'error' && r.skipped !== 'waiting for address verification') await prisma.warnNotice.update({ where: { id: n.id }, data: { outreachCheckedAt: now } })
    if (r.skipped) out.skipped[r.skipped] = (out.skipped[r.skipped] ?? 0) + 1
    else { out.queued++; out.editions += r.editions; out.recipients += r.recipients }
  }
  return out
}
