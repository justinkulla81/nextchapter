// What a collapsed job card says, in one glance (owner's ask, 2026-10-16: "is this a good
// fit? why?"): one fit verdict, one why line, one quiet meta line. Pure and client-safe —
// no server-only imports — so the card components and tests share it.
// Tests: src/test/job-card.test.ts.

import { isWeakFit, type FitBucket, type LevelStep } from '@/lib/jobs/fit-bucket-types'
import { WORK_TYPE_CHIP, type JobWorkType } from '@/lib/jobs/work-type'

// ── The verdict ────────────────────────────────────────────────────────────────

export type CardVerdict = 'strong' | 'good' | 'worth_a_look'

export const CARD_VERDICT_LABEL: Record<CardVerdict, string> = {
  strong: 'Strong fit',
  good: 'Good fit',
  worth_a_look: 'Worth a look',
}

/**
 * The card's single fit label, from the one score behind the board: fit scoring v2's
 * bucket (job-fit-bucket.ts), held to strict relevance (relevance.ts) — a job that only
 * reached the board through a widening ring (it carries a bridge) misses one of level,
 * field, place, skills or industry, so it reads "Worth a look", like its section. Below
 * the "good" bar (a stretch up, a step down, or a level we can't read) is "Worth a look"
 * too; the why line says which way the level runs.
 */
export function cardVerdict(fitBucket: FitBucket, opts: { bridge?: boolean } = {}): CardVerdict {
  if (isWeakFit(fitBucket) || opts.bridge) return 'worth_a_look'
  return fitBucket === 'strong' ? 'strong' : 'good'
}

// ── The why line ───────────────────────────────────────────────────────────────

/** Seniority against the member's level, for the why line; null when either level is unknown. */
export function levelPhrase(step: LevelStep | null | undefined): string | null {
  switch (step) {
    case 'same':
      return 'your level'
    case 'up':
      return 'one level up'
    case 'big_up':
      return 'two or more levels up'
    case 'down':
      return 'one level down'
    case 'big_down':
      return 'well below your level'
    default:
      return null
  }
}

/** "Fits you: your level · finance · near Louisville — Gap: asks for PE-backed experience". */
export function whyLineText(why: { fits: string[]; gap: string | null }): string {
  const fits = why.fits.length > 0 ? `Fits you: ${why.fits.join(' · ')}` : ''
  const gap = why.gap ? `Gap: ${why.gap}` : ''
  return [fits, gap].filter(Boolean).join(' — ')
}

// ── The meta line ──────────────────────────────────────────────────────────────

const REMOTE = /\bremote\b/i
const INTERIM = /\binterim\b/i

/** Past this, a card stops implying the job is live and says when we last checked it. */
export const STALE_CHECK_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

/** "Last checked 5 days ago" when the posting hasn't been verified live in 3+ days, else null. */
export function lastCheckedPhrase(verifiedAt: Date | string | null | undefined, now: Date = new Date()): string | null {
  if (!verifiedAt) return null
  const at = typeof verifiedAt === 'string' ? new Date(verifiedAt) : verifiedAt
  if (Number.isNaN(at.getTime())) return null
  const days = Math.floor((now.getTime() - at.getTime()) / DAY_MS)
  return days > STALE_CHECK_DAYS ? `Last checked ${days} days ago` : null
}

/**
 * Posted time · location (or Remote) · pay when known · the kind of work only when it
 * isn't the default full-time role (Contract, Part-time, Interim, Advisory / board,
 * Internship). Never "Full-time" and never the level — the title already says it.
 * A posting not verified live in over 3 days (verifiedAt = lastVerifiedAt) says so in the
 * same phrase: "Posted 9 days ago, last checked 5 days ago".
 */
export function cardMetaParts(input: {
  posted: string | null
  location: string | null
  remote?: boolean
  pay: string | null
  workType: JobWorkType
  title: string
  verifiedAt?: Date | string | null
  now?: Date
}): string[] {
  const parts: string[] = []
  const checked = lastCheckedPhrase(input.verifiedAt, input.now)
  if (input.posted && checked) parts.push(`${input.posted}, ${checked.charAt(0).toLowerCase()}${checked.slice(1)}`)
  else if (input.posted || checked) parts.push((input.posted ?? checked)!)
  const location = input.location?.trim() || null
  if (location) parts.push(location)
  if (input.remote && !(location && REMOTE.test(location))) parts.push('Remote')
  if (input.pay) parts.push(input.pay)
  if (input.workType !== 'full_time') parts.push(WORK_TYPE_CHIP[input.workType])
  else if (INTERIM.test(input.title)) parts.push('Interim')
  return parts
}

// ── Plain text, for emails and coach views ─────────────────────────────────────

/**
 * One job card as text (job-card-server.ts builds it from the same helpers as the board):
 * emails and other no-hover surfaces render the verdict, the why line and the meta line
 * from this, so every surface says the same thing about a job.
 */
export interface JobCardText {
  verdict: CardVerdict
  /** "Strong fit" / "Good fit" / "Worth a look". */
  verdictLabel: string
  fits: string[]
  gap: string | null
  /** "Fits you: your level · finance — Gap: asks for SQL"; '' when nothing specific is known. */
  whyLine: string
  /** Posted · place · pay · non-default work type (cardMetaParts). */
  meta: string[]
  /** The board's tappable "Likely fewer applicants" hint, for app surfaces. */
  fewerApplicantsHint: { label: string; because: string } | null
  /** "Likely fewer applicants (search-firm listing, on-site)", for emails; null unless the estimate is low. */
  fewerApplicants: string | null
}

/** The meta line as one string, with the plain-text applicants estimate at the end: "Posted 3h ago · Louisville, KY · Likely fewer applicants (on-site)". */
export function metaLineText(card: Pick<JobCardText, 'meta' | 'fewerApplicants'>): string {
  return [...card.meta, card.fewerApplicants].filter(Boolean).join(' · ')
}
