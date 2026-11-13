import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { CAMPAIGN } from './plan'
import { queueOutreachForNotice } from './for-notice'
import { releaseTime, modeForAge, BACKFILL_DAYS, BACKFILL_MIN_EMPLOYEES, BATCH } from './backfill-rules'

/**
 * One-off catch-up for the layoffs the live sweep never emailed (it only sees layoffs under 5 days old): every US layoff of 50+ people
 * announced in the last 60 days, one notice per employer, biggest first so a shared partner (a state Rapid Response coordinator, a
 * workforce board) is written to about the biggest layoff. Layoffs announced 14 days ago or less get the standard email; older ones get
 * the continued-support wording. Nothing here sends: each email is made as a DRAFT edition, and `releaseHeld` schedules them
 * only when the owner clicks it. `discardHeld` deletes the drafts.
 *
 * Reads, per page view: one query of about 900 rows (id, employer, date, headcount) and a few counts. Per batch of BATCH layoffs:
 * the same reads one live outreach does (CRM contacts, one picture, the suppression table) for each.
 */

interface Candidate { id: string; employer: string; employees: number; noticeDate: Date }

/** One notice per employer (the newest), US, 50+ people, announced in the window, not dismissed, not yet looked at by the sweep or this backfill, with no outreach edition yet for the employer. Biggest first. */
export async function pendingCandidates(now = new Date()): Promise<Candidate[]> {
  const since = new Date(now.getTime() - BACKFILL_DAYS * 86_400_000)
  return prisma.$queryRaw<Candidate[]>`
    SELECT DISTINCT ON (w."normalizedEmployer") w.id, w.employer, w.employees, w."noticeDate"
    FROM "WarnNotice" w
    WHERE w."noticeDate" >= ${since} AND w."noticeDate" <= ${now} AND w."dismissedAt" IS NULL
      AND w.employees >= ${BACKFILL_MIN_EMPLOYEES} AND (w.country IS NULL OR w.country = 'US') AND w."outreachCheckedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "MailingEdition" e JOIN "WarnNotice" w2 ON w2.id = e."warnNoticeId"
        WHERE e.campaign = ${CAMPAIGN} AND w2."normalizedEmployer" = w."normalizedEmployer")
    ORDER BY w."normalizedEmployer", w."noticeDate" DESC`
}

export interface BatchResult { looked: number; queued: number; editions: number; recipients: number; skipped: Record<string, number>; remaining: number }

/** Makes held drafts for the next BATCH layoffs. Safe to repeat: an employer already drafted is no longer pending. */
export async function createHeldDrafts(now = new Date()): Promise<BatchResult> {
  const all = (await pendingCandidates(now)).sort((a, b) => b.employees - a.employees)
  const out: BatchResult = { looked: 0, queued: 0, editions: 0, recipients: 0, skipped: {}, remaining: all.length }
  for (const c of all.slice(0, BATCH)) {
    out.looked++
    const r = await queueOutreachForNotice(c.id, { hold: true, mode: modeForAge(c.noticeDate, now) })
    if (r.skipped) {
      out.skipped[r.skipped] = (out.skipped[r.skipped] ?? 0) + 1
      // A layoff with nobody to email must not be picked again every batch: leave a marker the next query skips.
      if (r.skipped === 'no contact with a verified address') await prisma.warnNotice.update({ where: { id: c.id }, data: { outreachCheckedAt: now } }).catch(() => undefined)
    } else { out.queued++; out.editions += r.editions; out.recipients += r.recipients }
  }
  captureServerEvent('admin', 'layoff_backfill_drafts_created', { looked: out.looked, queued: out.queued, editions: out.editions, recipients: out.recipients })
  return out
}

export interface HeldSummary { editions: number; recipients: number; byAudience: Record<string, number>; byMode: { new: number; older: number } }

const heldWhere = { campaign: CAMPAIGN, status: 'DRAFT' as const, createdByEmail: 'layoff-backfill' }

export async function heldSummary(): Promise<HeldSummary> {
  const eds = await prisma.mailingEdition.findMany({ where: heldWhere, select: { id: true, audience: true, bodyHtml: true, _count: { select: { recipients: { where: { excluded: false } } } } }, take: 2000 })
  const byAudience: Record<string, number> = {}
  const byMode = { new: 0, older: 0 }
  let recipients = 0
  for (const e of eds) {
    const n = e._count.recipients
    recipients += n
    byAudience[e.audience ?? 'other'] = (byAudience[e.audience ?? 'other'] ?? 0) + n
    // The continued-support wording says "a few weeks"; the standard wording never does.
    if (/a few weeks/.test(e.bodyHtml)) byMode.older += n; else byMode.new += n
  }
  return { editions: eds.length, recipients, byAudience, byMode }
}

/**
 * Schedules every held draft for `at` (default: the next Monday 9:00 Eastern). First takes out anyone who has been suppressed since the
 * draft was made. The mailing tool then sends inside its 7 a.m. to 5 p.m. Eastern window at its hourly rate and daily cap.
 */
export async function releaseHeld(at: Date = releaseTime(new Date())): Promise<{ editions: number; recipients: number; removed: number; at: Date }> {
  const eds = await prisma.mailingEdition.findMany({ where: heldWhere, select: { id: true } })
  const ids = eds.map((e) => e.id)
  if (ids.length === 0) return { editions: 0, recipients: 0, removed: 0, at }
  const rows = await prisma.mailingEditionRecipient.findMany({ where: { editionId: { in: ids }, excluded: false }, select: { id: true, email: true } })
  const emails = [...new Set(rows.map((r) => r.email))]
  const suppressed = emails.length ? new Set((await prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((s) => s.email)) : new Set<string>()
  const drop = rows.filter((r) => suppressed.has(r.email)).map((r) => r.id)
  if (drop.length) await prisma.mailingEditionRecipient.updateMany({ where: { id: { in: drop } }, data: { excluded: true, excludedReason: 'suppressed_since_draft' } })
  await prisma.mailingEdition.updateMany({ where: { id: { in: ids }, status: 'DRAFT' }, data: { status: 'SCHEDULED', scheduledAt: at } })
  captureServerEvent('admin', 'layoff_backfill_released', { editions: ids.length, recipients: rows.length - drop.length, removed: drop.length, at: at.toISOString() })
  return { editions: ids.length, recipients: rows.length - drop.length, removed: drop.length, at }
}

/** Deletes the held drafts (and their recipients), so the layoffs are pending again. */
export async function discardHeld(): Promise<number> {
  const r = await prisma.mailingEdition.deleteMany({ where: heldWhere })
  captureServerEvent('admin', 'layoff_backfill_discarded', { editions: r.count })
  return r.count
}
