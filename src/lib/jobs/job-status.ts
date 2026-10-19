// Current vs past jobs — the one status model every surface uses. Pure (no I/O),
// so every rule is unit-tested (src/test/job-status.test.ts).
//
// ── Statuses ──────────────────────────────────────────────────────────────
// Current (listed now — apply works):
//   new        listed, and this role has not been seen before.
//   reposted   the same role (repostKey: company + normalized title + place) was
//              seen before — it closed and came back (the crawler's reopen_count),
//              an earlier listing of it closed, or it returned with a new
//              requisition id. Shown as "Reposted · first seen <date>, N times";
//              ghost-risk.ts puts repeat reposts "on watch".
//   duplicate  the same role listed again at the same time under another URL or
//              source. Collapsed to one card: the direct / ATS copy is shown (it
//              carries duplicateCount), the others are archived with closeReason
//              'duplicate' — still current, never counted as a past job or a closure.
// Past (no apply button):
//   closed     the employer stopped listing it — most likely filled or pulled
//              (closeReason 'removed'; also 'filtered' / 'manual' — we took it down).
//   expired    it aged past our freshness window while possibly still listed
//              (closeReason 'aged_out': director and above 60 days, everyone else 30,
//              the same windows the crawler's master-list.py export uses; a direct
//              employer listing — directListing — only past DIRECT_MAX_AGE_DAYS), or it was
//              not reconfirmed before its expiresAt ('expired').
// Every past job carries closedAt, closeReason and daysOpen (closedAt − posted date,
// or first-seen date when the source gives no posting date).
// Crawler counts per state: python3 ~/nextchapter-jobs/repost_groups.py.
//
// ── Where each source maps ─────────────────────────────────────────────────
//   crawler (~/nextchapter-jobs/data/jobs.db): active=1 → current (new /
//     reposted / duplicate by repost_key group, repost_groups.py); close_reason
//     removed / removed_inferred → 'removed'; aged_out / aged_out_inferred →
//     'aged_out'; cleanup_* / reseller_filter → 'filtered'. Each import row
//     carries reopenCount, repostCount, repostFirstSeenAt (the role's original
//     first-seen date), duplicateCount, and duplicateOf on a second copy.
//   ExclusiveJobPosting (the board): archivedAt null and not past expiresAt → open;
//     archivedAt set → closed or expired by closeReason. The import's finalize
//     records WHY it archived a row ('aged_out' when it is past the window, else
//     'removed'); the expire cron writes 'expired'. Rows archived before
//     closeReason existed are inferred on read (inferCloseReason).
//   CompanyJobOpening (company history): closedAt null → open; closedAt set →
//     closed/expired by closeReason, copied from the board row when it is archived.
//
// ── Retention policy: nothing is deleted ───────────────────────────────────
//   - The crawler keeps every job it has ever seen (active=0 rows, plus
//     job_status_events and job_versions).
//   - The board archives (archivedAt), never deletes, and a listing that comes back
//     is simply un-archived on the next import.
//   - CompanyJobOpening keeps closed rows forever; it is the past-jobs source for
//     search, company pages and analytics.
//   - Past jobs are never in BoardLightRow's live ranking, never in emails
//     (liveBoardWhere: archivedAt null + unexpired), and never get an apply button.

import { seniorityGroupOf } from '@/lib/jobs/job-seniority'

export type JobLifecycleStatus = 'new' | 'reposted' | 'duplicate' | 'closed' | 'expired'
// 'expired_checked': our liveness check found the posting dead (404, redirect to the careers
// home, "no longer accepting applications", gone from the aggregator's API) — ncrawl/liveness.py
// and the click-time check (src/lib/jobs/liveness.ts).
export type CloseReason = 'removed' | 'aged_out' | 'expired' | 'filtered' | 'manual' | 'duplicate' | 'expired_checked'

export const CLOSE_REASONS: readonly CloseReason[] = ['removed', 'aged_out', 'expired', 'filtered', 'manual', 'duplicate', 'expired_checked']

/** Statuses that are current (listed somewhere now). */
export const CURRENT_STATUSES: readonly JobLifecycleStatus[] = ['new', 'reposted', 'duplicate']

/** Freshness windows (days), matching the crawler's export (ncrawl config.max_age_for). */
export const FRESH_DAYS_DEFAULT = 30
export const FRESH_DAYS_SENIOR = 60
/**
 * Direct employer listings (directListing: from the employer's own careers site / ATS,
 * ncrawl config.is_direct) have no 30 / 60-day window: they stay while the employer still
 * lists them, up to this backstop (ncrawl NC_DIRECT_MAX_AGE_DAYS), which catches evergreen
 * "always hiring" reqs. Owner's call 2026-10-19.
 */
export const DIRECT_MAX_AGE_DAYS = 365
const SENIOR_GROUPS = new Set(['EXECUTIVE', 'VP', 'DIRECTOR'])

const DAY_MS = 86_400_000

/** Director and above stay listed 60 days, everyone else 30. `level` is a rung (DIRECTOR, VP…) or a seniority group. */
export function freshnessWindowDays(level: string | null | undefined): number {
  if (!level) return FRESH_DAYS_DEFAULT
  const group = seniorityGroupOf(level) ?? level
  return SENIOR_GROUPS.has(group) ? FRESH_DAYS_SENIOR : FRESH_DAYS_DEFAULT
}

/** Rungs whose window is 60 days — for SQL that classifies many rows at once. */
export function seniorWindowLevels(levels: readonly string[]): string[] {
  return levels.filter((l) => freshnessWindowDays(l) === FRESH_DAYS_SENIOR)
}

export function isCloseReason(v: unknown): v is CloseReason {
  return typeof v === 'string' && (CLOSE_REASONS as readonly string[]).includes(v)
}

/** The crawler's close_reason (jobs.close_reason / job_status_events.reason) in our vocabulary. */
export function mapCrawlerCloseReason(reason: string | null | undefined): CloseReason | null {
  if (!reason) return null
  const r = reason.trim().toLowerCase()
  if (r.startsWith('removed')) return 'removed'
  if (r.startsWith('aged_out')) return 'aged_out'
  if (r === 'expired_checked') return 'expired_checked'
  if (r.startsWith('cleanup') || r.endsWith('_filter')) return 'filtered'
  return null
}

/**
 * Why the import's finalize is archiving a listing the crawl no longer sends: past
 * our freshness window → 'aged_out' (it may well still be up), otherwise the
 * employer stopped listing it → 'removed'.
 */
export function finalizeCloseReason(row: { postedAt: Date | null; createdAt: Date; level: string | null; directListing?: boolean | null }, now: Date): CloseReason {
  const since = row.postedAt ?? row.createdAt
  const window = row.directListing ? DIRECT_MAX_AGE_DAYS : freshnessWindowDays(row.level)
  return (now.getTime() - since.getTime()) / DAY_MS > window ? 'aged_out' : 'removed'
}

/** For a past job archived before reasons were kept: same rule, judged at its close date. */
export function inferCloseReason(row: { postedAt: Date | null; openedAt: Date; closedAt: Date; level: string | null }): CloseReason {
  return finalizeCloseReason({ postedAt: row.postedAt, createdAt: row.openedAt, level: row.level }, row.closedAt)
}

export interface LifecycleInput {
  archivedAt: Date | null
  expiresAt?: Date | null
  closeReason?: string | null
  postedAt: Date | null
  /** First seen / imported. */
  createdAt: Date
  level?: string | null
  reopenCount?: number | null
  /** Times the role came back (crawler repost_groups.py). */
  repostCount?: number | null
  /** The role's original first-seen date across its reposts. */
  repostFirstSeenAt?: Date | null
  /** Other copies of this role collapsed into this card. */
  duplicateCount?: number | null
  /** Times this company + title + place was posted and closed before (ghost-risk data). */
  priorClosedCount?: number | null
}

export interface JobLifecycle {
  status: JobLifecycleStatus
  isPast: boolean
  closedAt: Date | null
  closeReason: CloseReason | null
  /** Days from posted (or first seen) to close — or to now while open. */
  daysOpen: number
  /** Times it came back: the crawler's repost / reopen count, else prior closures of the same role. */
  repostCount: number
  /** When the role was first seen (across reposts) — the posted / first-seen date when it never came back. */
  firstSeenAt: Date
  /** Other listings of the same role collapsed into this one. */
  duplicateCount: number
}

export function jobLifecycle(j: LifecycleInput, now: Date = new Date()): JobLifecycle {
  const opened = j.postedAt ?? j.createdAt
  const repostCount = Math.max(j.repostCount ?? 0, j.reopenCount ?? 0, j.priorClosedCount ?? 0)
  const firstSeenAt = j.repostFirstSeenAt && j.repostFirstSeenAt < opened ? j.repostFirstSeenAt : opened
  const duplicateCount = Math.max(0, j.duplicateCount ?? 0)
  const base = { repostCount, firstSeenAt, duplicateCount }
  let closedAt: Date | null = j.archivedAt
  let closeReason: CloseReason | null = null
  if (closedAt) {
    closeReason = isCloseReason(j.closeReason)
      ? j.closeReason
      : inferCloseReason({ postedAt: j.postedAt, openedAt: j.createdAt, closedAt, level: j.level ?? null })
  } else if (j.expiresAt && j.expiresAt.getTime() <= now.getTime()) {
    // Past expiry but not yet swept by the daily cron: already gone from the board.
    closedAt = j.expiresAt
    closeReason = 'expired'
  }
  // A collapsed second copy is a current job, shown through its primary copy.
  if (closeReason === 'duplicate') {
    const daysOpen = Math.max(0, Math.floor((now.getTime() - opened.getTime()) / DAY_MS))
    return { ...base, status: 'duplicate', isPast: false, closedAt: null, closeReason, daysOpen }
  }
  const end = closedAt ?? now
  const daysOpen = Math.max(0, Math.floor((end.getTime() - opened.getTime()) / DAY_MS))
  const status: JobLifecycleStatus = closedAt
    ? closeReason === 'aged_out' || closeReason === 'expired'
      ? 'expired'
      : 'closed'
    : repostCount > 0
      ? 'reposted'
      : 'new'
  return { ...base, status, isPast: !!closedAt, closedAt, closeReason, daysOpen }
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** Short badge text: "Closed", "No longer listed", "Reposted", "Duplicate listing", "Open". */
export function lifecycleBadge(l: JobLifecycle): string {
  if (l.status === 'closed') return 'Closed'
  if (l.status === 'expired') return 'No longer listed'
  if (l.status === 'reposted') return 'Reposted'
  if (l.status === 'duplicate') return 'Duplicate listing'
  return 'Open'
}

/** "Reposted · first seen Oct 2, 2026, 3 times" — null for a role never seen before. */
export function repostLine(r: { repostCount: number; firstSeenAt: Date }): string | null {
  if (r.repostCount <= 0) return null
  return `Reposted · first seen ${fmtDate(r.firstSeenAt)}, ${r.repostCount} ${r.repostCount === 1 ? 'time' : 'times'}`
}

/** "Also listed in 2 other places" — the duplicates collapsed into this card. */
export function duplicateLine(duplicateCount: number | null | undefined): string | null {
  const n = duplicateCount ?? 0
  return n > 0 ? `Also listed in ${n} other ${n === 1 ? 'place' : 'places'}` : null
}

/** The repost line straight from a posting's stored fields (board cards, company history). */
export function postingRepostLine(p: { repostCount?: number | null; reopenCount?: number | null; repostFirstSeenAt?: Date | null; postedAt?: Date | null; createdAt: Date }): string | null {
  const opened = p.postedAt ?? p.createdAt
  const firstSeenAt = p.repostFirstSeenAt && p.repostFirstSeenAt < opened ? p.repostFirstSeenAt : opened
  return repostLine({ repostCount: Math.max(p.repostCount ?? 0, p.reopenCount ?? 0), firstSeenAt })
}

/** The banner on a past job: what happened and when, in plain words. */
export function lifecycleSentence(l: JobLifecycle): string | null {
  if (!l.isPast || !l.closedAt) return null
  if (l.status === 'closed') {
    if (l.closeReason === 'removed')
      return `This job closed on ${fmtDate(l.closedAt)}. The employer took the listing down — it was most likely filled or pulled.`
    if (l.closeReason === 'expired_checked')
      return `This job closed on ${fmtDate(l.closedAt)}. We checked the listing and it is no longer taking applications.`
    return `This job closed on ${fmtDate(l.closedAt)}.`
  }
  return `No longer listed as of ${fmtDate(l.closedAt)}. It passed our freshness window, so it may still be up on the employer's site, but it is unlikely to be actively hiring.`
}

/** "Posted 12 days ago" plus the repost line for a current job; "Open 41 days" for a past one. */
export function postedLine(l: JobLifecycle): string {
  const days = l.daysOpen
  const head = l.isPast
    ? `Open ${days} ${days === 1 ? 'day' : 'days'}`
    : days === 0
      ? 'Posted today'
      : `Posted ${days} ${days === 1 ? 'day' : 'days'} ago`
  return [head, repostLine(l), duplicateLine(l.duplicateCount)].filter(Boolean).join(' · ')
}

// Next steps for a past job: the live board searched for the same company, and for the same title.
/** The board search for one company (company:"Name") or one title. */
export function alternativesHrefs(companyName: string | null, title: string) {
  const company = companyName?.replace(/"/g, '').trim()
  const cleanTitle = title.replace(/"/g, '').replace(/\s+[-–|]\s.*$|\s*\(.*$/, '').trim() || title.replace(/"/g, '')
  return {
    company: company ? `/dashboard/find-my-job?q=${encodeURIComponent(`company:"${company}"`)}` : null,
    title: `/dashboard/find-my-job?q=${encodeURIComponent(`"${cleanTitle}"`)}`,
    titleLabel: cleanTitle,
  }
}
