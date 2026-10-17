import type { ExclusiveJobPosting } from '@prisma/client'

/**
 * How crowded a job is likely to be, from facts we hold about it — no
 * applicant counts exist for most sources, so this is a rules score whose
 * every point is a reason a member can read on the card:
 *
 * - where it's listed: a search-firm mandate or association board is seen by
 *   few job seekers; a remote job on a public aggregator by everyone
 * - remote roles draw several times the applicants of on-site/hybrid ones
 * - age: the first days after posting are when an application stands out
 * - listed by one of our sources only, i.e. not syndicated everywhere
 * - hiring volume: an employer with 100+ open roles on our board is usually
 *   a big brand drawing heavy applicant flow; one with a handful isn't
 */

export type CompetitionLevel = 'low' | 'medium' | 'high'

export interface CompetitionScore {
  level: CompetitionLevel
  reasons: string[]
  /**
   * The points that make the job less crowded, short, for the card's "Likely fewer
   * applicants" hint: "Search-firm listing", "on-site", "posted 34h ago". Only the
   * reasons in its favour — the hint never lists what counts against it.
   */
  fewer?: string[]
}

type Scorable = Pick<ExclusiveJobPosting, 'sourceCategory' | 'location' | 'postedAt' | 'createdAt' | 'sourceCount'>

const DAY_MS = 86_400_000
const REMOTE = /\bremote\b/i

export function postedDateOf(p: Pick<ExclusiveJobPosting, 'postedAt' | 'createdAt'>): Date {
  return p.postedAt ?? p.createdAt
}

export function hoursSincePosted(p: Pick<ExclusiveJobPosting, 'postedAt' | 'createdAt'>, now = new Date()): number {
  return Math.max(0, (now.getTime() - postedDateOf(p).getTime()) / 3_600_000)
}

/** "Posted 14 hours ago" / "Posted 2 days ago". */
export function postedAgo(p: Pick<ExclusiveJobPosting, 'postedAt' | 'createdAt'>, now = new Date()): string {
  const hours = hoursSincePosted(p, now)
  if (hours < 1) return 'Posted in the last hour'
  if (hours < 48) return `Posted ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`
  return `Posted ${Math.floor(hours / 24)} days ago`
}

export const FRESH_HOURS = 72

export function isFresh(p: Pick<ExclusiveJobPosting, 'postedAt' | 'createdAt'>, now = new Date()): boolean {
  return hoursSincePosted(p, now) <= FRESH_HOURS
}

/** "posted 34h ago" / "posted 3d ago" — the short form for a hint. */
export function shortAgo(p: Pick<ExclusiveJobPosting, 'postedAt' | 'createdAt'>, now = new Date()): string {
  const hours = hoursSincePosted(p, now)
  if (hours < 1) return 'posted in the last hour'
  if (hours < 48) return `posted ${Math.round(hours)}h ago`
  return `posted ${Math.floor(hours / 24)}d ago`
}

/**
 * The card's competition hint, or null when it shouldn't show. The score is a rules
 * estimate (where it's listed, remote or not, age, one source, employer size) — never an
 * applicant count — so the label says "likely" and only shows when the estimate is low.
 */
export function fewerApplicantsHint(competition: CompetitionScore | undefined): { label: string; because: string } | null {
  if (competition?.level !== 'low') return null
  const parts = (competition.fewer ?? []).slice(0, 3)
  const because = parts.length > 0 ? parts.join(' · ') : competition.reasons.join(' · ')
  return { label: 'Likely fewer applicants', because: because.charAt(0).toUpperCase() + because.slice(1) }
}

export const FEWER_APPLICANTS_NOTE = 'Our estimate from where and when it was posted — not an applicant count.'

/** `companyJobCount`: live board jobs at the same employer (size proxy). */
export function scoreCompetition(p: Scorable, companyJobCount: number, now = new Date()): CompetitionScore {
  let score = 0
  const reasons: string[] = []
  const fewer: string[] = []

  switch (p.sourceCategory) {
    case 'search_firm':
      score += 3
      reasons.push('Search-firm mandate — not on the big job boards')
      fewer.push('Search-firm listing')
      break
    case 'association':
      score += 2
      reasons.push('Association job board — mostly members see it')
      fewer.push('Association board')
      break
    case 'pe':
      score += 1
      reasons.push('Private-equity portfolio board — few job seekers look here')
      fewer.push('PE portfolio board')
      break
    case 'aggregator':
      score -= 2
      reasons.push('Listed on a public job aggregator')
      break
  }

  if (p.location && REMOTE.test(p.location)) {
    score -= 2
    reasons.push('Remote — draws the most applicants')
  } else if (p.location) {
    score += 1
    reasons.push('On-site or hybrid — a smaller, local applicant pool')
    fewer.push('on-site')
  }

  const ageDays = (now.getTime() - postedDateOf(p).getTime()) / DAY_MS
  if (ageDays <= 7) {
    score += 1
    reasons.push('Posted in the last week')
    fewer.push(shortAgo(p, now))
  } else if (ageDays > 21) {
    score -= 1
    reasons.push('Posted over three weeks ago')
  }

  if (p.sourceCount === 1) {
    score += 1
    reasons.push('Listed in one place, not syndicated everywhere')
    fewer.push('listed in one place')
  } else if ((p.sourceCount ?? 0) >= 3) {
    score -= 1
    reasons.push('Syndicated widely')
  }

  if (companyJobCount > 0 && companyJobCount <= 5) {
    score += 1
    reasons.push('Few openings listed at this employer')
    fewer.push('few openings at this employer')
  } else if (companyJobCount >= 100) {
    score -= 1
    reasons.push('Hiring at volume (100+ roles) — heavy applicant flow')
  }

  return { level: score >= 3 ? 'low' : score <= 0 ? 'high' : 'medium', reasons, fewer }
}

/**
 * The single most useful move for this job, by the channel it came through — one short
 * line next to the apply action in the open card, never the card's headline.
 */
export function edgeTip(p: Pick<ExclusiveJobPosting, 'sourceCategory' | 'sourceName' | 'postedAt' | 'createdAt'>, now = new Date()): string {
  if (p.sourceCategory === 'search_firm') return `Search-firm listing — write to the partner at ${p.sourceName ?? 'the firm'} directly.`
  if (p.sourceCategory === 'association') return 'Association board — mention your membership or ties.'
  if (isFresh(p, now)) return 'Posted in the last 72 hours — apply early; early applicants get most interviews.'
  if (p.sourceCategory === 'pe') return 'PE-backed — PE experience or an operating-partner intro stands out.'
  return 'A referral beats a cold application — find someone who works there.'
}

/** Sorts low competition first (with fit as the primary key, by callers). */
export const COMPETITION_SORT_RANK: Record<CompetitionLevel, number> = { low: 0, medium: 1, high: 2 }
