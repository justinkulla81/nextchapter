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

/** `companyJobCount`: live board jobs at the same employer (size proxy). */
export function scoreCompetition(p: Scorable, companyJobCount: number, now = new Date()): CompetitionScore {
  let score = 0
  const reasons: string[] = []

  switch (p.sourceCategory) {
    case 'search_firm':
      score += 3
      reasons.push('Search-firm mandate — not on the big job boards')
      break
    case 'association':
      score += 2
      reasons.push('Association job board — mostly members see it')
      break
    case 'pe':
      score += 1
      reasons.push('Private-equity portfolio board — few job seekers look here')
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
  }

  const ageDays = (now.getTime() - postedDateOf(p).getTime()) / DAY_MS
  if (ageDays <= 7) {
    score += 1
    reasons.push('Posted in the last week')
  } else if (ageDays > 21) {
    score -= 1
    reasons.push('Posted over three weeks ago')
  }

  if (p.sourceCount === 1) {
    score += 1
    reasons.push('Listed in one place, not syndicated everywhere')
  } else if ((p.sourceCount ?? 0) >= 3) {
    score -= 1
    reasons.push('Syndicated widely')
  }

  if (companyJobCount > 0 && companyJobCount <= 5) {
    score += 1
    reasons.push('Few openings listed at this employer')
  } else if (companyJobCount >= 100) {
    score -= 1
    reasons.push('Hiring at volume (100+ roles) — heavy applicant flow')
  }

  return { level: score >= 3 ? 'low' : score <= 0 ? 'high' : 'medium', reasons }
}

/** The single most useful move for this job, shown on the card. */
export function edgeTip(p: Pick<ExclusiveJobPosting, 'sourceCategory' | 'sourceName' | 'postedAt' | 'createdAt'>, now = new Date()): string {
  if (p.sourceCategory === 'search_firm') {
    return `Write to the consultant at ${p.sourceName ?? 'the search firm'} directly with a short, tailored note — don't rely on the apply form.`
  }
  if (isFresh(p, now)) return 'Apply in the first 72 hours — early applicants get most of the interviews.'
  if (p.sourceCategory === 'association') return 'Mention your membership or ties to the association in your note.'
  return 'Find someone who works there — a referral beats a cold application.'
}

/** Sorts low competition first (with fit as the primary key, by callers). */
export const COMPETITION_SORT_RANK: Record<CompetitionLevel, number> = { low: 0, medium: 1, high: 2 }

/**
 * One line shown on the collapsed card: why this job is worth a move, and
 * the move. Search-firm and association jobs lead with where they're from;
 * fresh jobs with timing; other low-competition jobs with their strongest
 * reason; everything else with the referral advice.
 */
export function edgeHeadline(
  p: Pick<ExclusiveJobPosting, 'sourceCategory' | 'sourceName' | 'postedAt' | 'createdAt'>,
  competition: CompetitionScore | undefined,
  now = new Date()
): string {
  if (p.sourceCategory === 'search_firm') return 'Search-firm mandate — contact the partner directly'
  if (p.sourceCategory === 'association') return 'Association board, few applicants — mention your membership or ties'
  if (isFresh(p, now)) return `${postedAgo(p, now)} — apply first`
  if (competition?.level === 'low' && competition.reasons[0]) return `Low competition: ${competition.reasons[0].toLowerCase()}`
  if (p.sourceCategory === 'pe') return 'PE-backed — PE experience and an operating-partner intro stand out'
  return 'Find someone who works there — a referral beats a cold application'
}
