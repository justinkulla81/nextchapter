import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { CAMPAIGN } from './plan'
import { queueOutreachForNotice } from './for-notice'
import { releaseTime, modeForAge, BACKFILL_DAYS, BACKFILL_MIN_EMPLOYEES, BATCH, SUPPRESSION_MARK_BEFORE, assignDaysByCap, assignArms, businessDayTimes } from './backfill-rules'
import { LAYOFF_RAMP } from '@/lib/mailing/layoff-pacing-rules'
import { addressQuality, needsVerification } from './quality'
import { ensureVerified } from './verify'
import { loadAddressFacts } from './quality-data'
import { headlineFor, type HeadlineCode, type HeadlineFacts } from './copy'

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
      AND w.employees >= ${BACKFILL_MIN_EMPLOYEES} AND (w.country IS NULL OR w.country = 'US') AND (w."outreachCheckedAt" IS NULL OR w."outreachCheckedAt" <= ${SUPPRESSION_MARK_BEFORE})
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

export interface DayPlan { day: number; at: Date; editions: number; recipients: number; arms: Record<string, { editions: number; recipients: number }> }

const AUDIENCE_TO_COPY: Record<string, HeadlineFacts['audience']> = {
  outplacement: 'hr', rapid_response: 'rapid_response', workforce_board: 'workforce_board', job_center: 'job_center', economic_development: 'economic_development',
}

/**
 * Schedules every held draft across the four days Monday to Thursday of the coming week (balanced by recipients, 9:00 Eastern each day;
 * the mailing tool sends inside the layoff window, 8 a.m. to noon, at its hourly rate and daily cap). Owner, 2026-11-13: test a different
 * headline each day. Each day runs two headline styles (HEADLINE_DAYS) against each other, split evenly by audience, so the day is the
 * same for both; the subject is rewritten and the edition's title carries "h:<style>" so the campaigns page can read the result by style.
 * First takes out anyone suppressed since the draft was made, as releaseHeld does.
 */
export async function scheduleBackfillWeek(now = new Date()): Promise<{ days: DayPlan[]; removed: number; verifying?: number }> {
  const monday = releaseTime(now)
  const eds = await prisma.mailingEdition.findMany({
    where: heldWhere,
    select: { id: true, title: true, audience: true, warnNoticeId: true, bodyHtml: true, recipients: { where: { excluded: false }, select: { id: true, email: true, personId: true } } },
  })
  if (eds.length === 0) return { days: [], removed: 0 }
  // Every address nothing has checked recently is checked with Hunter first (one credit each, saved). If some are still waiting, nothing is
  // scheduled yet: the next hourly run carries on, and the week is scheduled once every address has an answer.
  const items = eds.flatMap((e) => e.recipients.map((r) => ({ email: r.email, personId: r.personId })))
  let pre = await loadAddressFacts(items)
  const toCheck = [...pre.values()].filter((f) => needsVerification(f, now)).map((f) => f.email)
  if (toCheck.length) {
    const v = await ensureVerified(toCheck, { max: 250, timeMs: 110_000 })
    if (v.checked) pre = await loadAddressFacts(items)
    const waiting = [...pre.values()].filter((f) => needsVerification(f, now)).length
    if (waiting > 0) return { days: [], removed: 0, verifying: waiting }
  }
  const emails = [...new Set(eds.flatMap((e) => e.recipients.map((r) => r.email)))]
  const suppressed = emails.length ? new Set((await prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((s) => s.email)) : new Set<string>()
  const drop = eds.flatMap((e) => e.recipients.filter((r) => suppressed.has(r.email)).map((r) => r.id))
  if (drop.length) await prisma.mailingEditionRecipient.updateMany({ where: { id: { in: drop } }, data: { excluded: true, excludedReason: 'suppressed_since_draft' } })
  const dropped = new Set(drop)
  // Re-screen every address against the quality rules (quality.ts: Hunter-deliverable CRM contacts only, no role addresses, no bounced domains)
  // and order the editions by how likely their addresses are to be real, so the safest go first and the sender builds its record on them.
  const live = eds.map((e) => ({ ...e, recipients: e.recipients.filter((r) => !dropped.has(r.id)) }))
  const facts = pre
  const failed: string[] = []
  const scored = live.map((e) => {
    const ok = e.recipients.filter((r) => {
      const f = facts.get(r.email.toLowerCase())
      const q = f ? addressQuality(f, now) : null
      if (!q?.ok) { failed.push(r.id); return false }
      return true
    })
    const mean = ok.length ? ok.reduce((sum, r) => sum + addressQuality(facts.get(r.email.toLowerCase())!, now).score, 0) / ok.length : 0
    return { ...e, n: ok.length, score: mean }
  })
  if (failed.length) await prisma.mailingEditionRecipient.updateMany({ where: { id: { in: failed } }, data: { excluded: true, excludedReason: 'screened_at_schedule' } })
  const sized = scored.filter((e) => e.n > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const noticeIds = [...new Set(sized.map((e) => e.warnNoticeId).filter((x): x is string => !!x))]
  const notices = new Map((await prisma.warnNotice.findMany({ where: { id: { in: noticeIds } }, select: { id: true, employer: true, employees: true, state: true, county: true } })).map((n) => [n.id, n]))

  // A trickle, not a batch: each day takes what the sender's own ramp allows (40, 60, 80, 100, then 120), best addresses first.
  const caps = [...LAYOFF_RAMP, ...new Array<number>(30).fill(LAYOFF_RAMP[LAYOFF_RAMP.length - 1])]
  const dayOf = assignDaysByCap(sized.map((e) => ({ id: e.id, recipients: e.n })), caps)
  const dayCount = sized.length ? Math.max(...dayOf.values()) + 1 : 0
  const times = businessDayTimes(monday, dayCount)
  const days: DayPlan[] = times.map((at, day) => ({ day, at, editions: 0, recipients: 0, arms: {} }))
  for (let day = 0; day < times.length; day++) {
    const today = sized.filter((e) => dayOf.get(e.id) === day)
    const arms = assignArms(today.map((e) => ({ id: e.id, audience: e.audience ?? 'other' })), day)
    for (const e of today) {
      const code = arms.get(e.id)! as HeadlineCode
      const notice = e.warnNoticeId ? notices.get(e.warnNoticeId) : undefined
      const hf: HeadlineFacts = {
        org: notice?.employer ?? e.title.split(' · ')[0], employees: notice?.employees ?? null, state: notice?.state ?? null, county: notice?.county ?? null,
        audience: AUDIENCE_TO_COPY[e.audience ?? ''] ?? 'hr', mode: /a few weeks/.test(e.bodyHtml) ? 'older' : 'new',
      }
      await prisma.mailingEdition.update({
        where: { id: e.id },
        data: { subject: headlineFor(code, hf).slice(0, 200), title: `${e.title.split(' · h:')[0]} · h:${code} · day ${day + 1}`, status: 'SCHEDULED', scheduledAt: times[day] },
      })
      days[day].editions++
      days[day].recipients += e.n
      const a = (days[day].arms[code] ??= { editions: 0, recipients: 0 })
      a.editions++
      a.recipients += e.n
    }
  }
  captureServerEvent('admin', 'layoff_backfill_week_scheduled', { editions: sized.length, recipients: days.reduce((s, d) => s + d.recipients, 0), removed: drop.length, screened_out: failed.length, days: days.map((d) => ({ at: d.at.toISOString(), recipients: d.recipients })) })
  return { days, removed: drop.length }
}

/**
 * The hourly driver (cron layoff-backfill): makes the held drafts for every layoff still pending, within a time budget, and once none is
 * pending and the next Monday is under four days away, schedules the week. Off with LAYOFF_BACKFILL_AUTO=0. Reads, per run: the pending
 * list (about 900 rows) per batch, plus what each drafted layoff reads (see createHeldDrafts).
 */
export async function runBackfillAuto(now = new Date()): Promise<{ drafted: { looked: number; queued: number; editions: number; recipients: number }; pending: number; scheduled: DayPlan[] | null; note: string | null }> {
  const out = { drafted: { looked: 0, queued: 0, editions: 0, recipients: 0 }, pending: 0, scheduled: null as DayPlan[] | null, note: null as string | null }
  if (/^(0|off|false)$/i.test(process.env.LAYOFF_BACKFILL_AUTO ?? '')) return { ...out, note: 'switched off' }
  const end = Date.now() + 170_000
  let pending = (await pendingCandidates(now)).length
  while (pending > 0 && Date.now() < end) {
    const r = await createHeldDrafts(now)
    out.drafted.looked += r.looked; out.drafted.queued += r.queued; out.drafted.editions += r.editions; out.drafted.recipients += r.recipients
    if (r.looked === 0 || r.queued + (r.skipped['no contact with a verified address'] ?? 0) === 0) { out.note = 'a batch made nothing; stopped'; break }
    pending = Math.max(0, r.remaining - r.looked)
  }
  out.pending = pending
  const daysToMonday = (releaseTime(now).getTime() - now.getTime()) / 86_400_000
  if (pending === 0 && daysToMonday < 4) {
    const s = await scheduleBackfillWeek(now)
    if (s.days.length) out.scheduled = s.days
    else if (s.verifying) out.note = `verifying addresses with Hunter, ${s.verifying} left`
  }
  return out
}
