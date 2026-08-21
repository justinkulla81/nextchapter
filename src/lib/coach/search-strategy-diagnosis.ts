import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'

// Deterministic pattern detection over real activity — no LLM call, so this
// can be computed live on every Coaching Notes / Market Reality page view
// with zero added cost, unlike the guidance text in search-strategy-guidance.ts.

export type SearchPatternKey =
  | 'applying_no_interviews'
  | 'applying_no_networking'
  | 'inactive'
  | 'networking_no_applying'
  | 'scattershot'
  | 'company_repeat'

export interface SearchPatternCause {
  cause: string
  fix: string
}

export interface SearchPatternFlag {
  key: SearchPatternKey
  label: string
  detail: string
  causes: SearchPatternCause[]
}

const RECENT_WINDOW_DAYS = 30

// A candidate needs to have been in the product long enough for "no
// activity in 30 days" to mean something — otherwise day-2 candidates who
// haven't gotten to applying yet get flagged as "inactive."
const ONBOARDING_GRACE_DAYS = 10

const LOW_APPLICATIONS_30D = 3
const LOW_OUTREACH_30D = 2

// Below this, "no interviews yet" just means "not enough attempts yet," not
// a real conversion problem worth diagnosing.
const MIN_APPLICATIONS_FOR_INTERVIEW_DIAGNOSIS = 15
const INTERVIEW_RATE_FLAG_THRESHOLD = 0.08

// Same threshold application-trends.ts uses for function-focus eligibility —
// kept in sync deliberately, not imported, since that module's version also
// gates industry/geography breakdowns this diagnosis doesn't need.
const MIN_APPLICATIONS_FOR_SCATTERSHOT = 5

const COMPANY_REPEAT_THRESHOLD = 3
const LOW_RESUME_SCORE_THRESHOLD = 70
const LOW_FIT_SCORE_THRESHOLD = 60
const LOW_VOLUME_ALL_TIME_THRESHOLD = 40

interface AppliedPosting {
  title: string | null
  companyName: string | null
  fitScore: number | null
}

function focusedFunctionCount(postings: AppliedPosting[]): { distinct: number; breakdown: string } | null {
  const counts = new Map<string, number>()
  for (const p of postings) {
    const fn = p.title ? inferFunctionFromTitle(p.title) : null
    if (!fn) continue
    counts.set(fn, (counts.get(fn) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  const breakdown = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} (${count})`)
    .join(', ')
  return { distinct: counts.size, breakdown }
}

function companyRepeats(postings: AppliedPosting[]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const p of postings) {
    if (!p.companyName) continue
    const key = p.companyName.trim().toLowerCase()
    if (!key) continue
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { name: p.companyName.trim(), count: 1 })
  }
  return Array.from(counts.values())
    .filter((c) => c.count >= COMPANY_REPEAT_THRESHOLD)
    .sort((a, b) => b.count - a.count)
}

function buildInterviewCauses(params: {
  outreachAllTime: number
  resumeScore: number | null
  functionFocus: { distinct: number; breakdown: string } | null
  avgFitScore: number | null
  totalApplications: number
}): SearchPatternCause[] {
  const causes: SearchPatternCause[] = []

  if (params.resumeScore !== null && params.resumeScore < LOW_RESUME_SCORE_THRESHOLD) {
    causes.push({
      cause: `Resume score is ${params.resumeScore}/100 — likely losing at the resume screen before a recruiter weighs real fit.`,
      fix: 'Work on the resume before applying further — a stronger resume raises the odds of every future application, not just the next one.',
    })
  }

  if (params.avgFitScore !== null && params.avgFitScore < LOW_FIT_SCORE_THRESHOLD) {
    causes.push({
      cause: `Average fit score across these applications is ${Math.round(params.avgFitScore)}/100 — many of these roles may not be a strong match (wrong level or wrong type).`,
      fix: 'Prioritize applying only to roles scoring 70+ on the fit check — fewer, better-matched applications beat volume against a mismatched target.',
    })
  }

  if (params.functionFocus && params.functionFocus.distinct >= 3) {
    causes.push({
      cause: `Applying across ${params.functionFocus.distinct} different types of roles (${params.functionFocus.breakdown}) — each application reads as a slightly different pitch.`,
      fix: 'Pick the strongest 1-2 target functions and concentrate applications there for the next few weeks.',
    })
  }

  if (params.outreachAllTime === 0) {
    causes.push({
      cause: 'No networking outreach logged at all — every one of these applications went in cold.',
      fix: 'Before applying to the next role, send one message to someone already at the company or adjacent to it.',
    })
  }

  if (causes.length === 0 && params.totalApplications < LOW_VOLUME_ALL_TIME_THRESHOLD) {
    causes.push({
      cause: `Still relatively early at ${params.totalApplications} applications — many searches need 30-50+ well-targeted applications before the first interview lands.`,
      fix: 'Keep the pace up — this may resolve with more volume rather than a strategy change.',
    })
  }

  if (causes.length === 0) {
    causes.push({
      cause: `${params.totalApplications} applications with no single clear explanatory gap in resume, fit, focus, or networking.`,
      fix: 'Worth a direct resume and positioning review together — the gap may be more subtle than any one signal catches.',
    })
  }

  return causes.slice(0, 3)
}

// Live-computed, all deterministic Prisma counts/aggregates — safe to call
// on every page view (Coaching Notes, Market Reality) with no metered cost.
export async function getSearchStrategyDiagnosis(candidateId: string): Promise<SearchPatternFlag[]> {
  const now = new Date()
  const recentWindowStart = new Date(now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [candidate, appliedPostings, applicationsRecent, outreachRecent, outreachAllTime, componentScore] =
    await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({
        where: { id: candidateId },
        select: { registrationCompletedAt: true },
      }),
      prisma.jobPosting.findMany({
        where: { candidateId, appliedAt: { not: null } },
        select: { title: true, companyName: true, fitScore: true, interviewLandedAt: true },
      }),
      prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: recentWindowStart } } }),
      prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: recentWindowStart } } }),
      prisma.outreachLog.count({ where: { candidateId } }),
      prisma.marketRealityComponentScore.findUnique({ where: { candidateId }, select: { resumeScore: true } }),
    ])

  const registeredAt = candidate.registrationCompletedAt
  const hasEnoughTenure = !!registeredAt && now.getTime() - registeredAt.getTime() >= ONBOARDING_GRACE_DAYS * 24 * 60 * 60 * 1000
  if (!hasEnoughTenure) return []

  const flags: SearchPatternFlag[] = []

  const totalApplications = appliedPostings.length
  const totalInterviewsLanded = appliedPostings.filter((p) => p.interviewLandedAt !== null).length
  const fitScores = appliedPostings.map((p) => p.fitScore).filter((s): s is number => s !== null)
  const avgFitScore = fitScores.length > 0 ? fitScores.reduce((a, b) => a + b, 0) / fitScores.length : null
  const functionFocus = totalApplications >= MIN_APPLICATIONS_FOR_SCATTERSHOT ? focusedFunctionCount(appliedPostings) : null

  // Pattern 1: applying a lot, no interviews.
  if (totalApplications >= MIN_APPLICATIONS_FOR_INTERVIEW_DIAGNOSIS) {
    const rate = totalInterviewsLanded / totalApplications
    if (rate < INTERVIEW_RATE_FLAG_THRESHOLD) {
      flags.push({
        key: 'applying_no_interviews',
        label: 'Applying without interviews',
        detail: `${totalApplications} applications, ${totalInterviewsLanded} interview${totalInterviewsLanded === 1 ? '' : 's'} landed (${Math.round(rate * 100)}% conversion).`,
        causes: buildInterviewCauses({
          outreachAllTime,
          resumeScore: componentScore?.resumeScore ?? null,
          functionFocus,
          avgFitScore,
          totalApplications,
        }),
      })
    }
  }

  // Patterns 2-4: apply-vs-network quadrant. (high, high) is healthy — no flag.
  const applyLevel: 'low' | 'high' = applicationsRecent < LOW_APPLICATIONS_30D ? 'low' : 'high'
  const networkLevel: 'low' | 'high' = outreachRecent < LOW_OUTREACH_30D ? 'low' : 'high'

  if (applyLevel === 'high' && networkLevel === 'low') {
    flags.push({
      key: 'applying_no_networking',
      label: 'High volume, low network',
      detail: `${applicationsRecent} applications but only ${outreachRecent} outreach message${outreachRecent === 1 ? '' : 's'} in the last ${RECENT_WINDOW_DAYS} days — going in cold on nearly everything.`,
      causes: [
        {
          cause: 'Applying at real volume with almost no networking behind it — most of these applications are landing as a stranger, not a referral.',
          fix: 'Add 2-3 outreach messages a week aimed at people already at the companies being applied to.',
        },
      ],
    })
  } else if (applyLevel === 'low' && networkLevel === 'low') {
    flags.push({
      key: 'inactive',
      label: 'Search has gone quiet',
      detail: `Only ${applicationsRecent} application${applicationsRecent === 1 ? '' : 's'} and ${outreachRecent} outreach message${outreachRecent === 1 ? '' : 's'} in the last ${RECENT_WINDOW_DAYS} days.`,
      causes: [
        {
          cause: 'No meaningful application or networking activity recently — the search has effectively paused.',
          fix: 'Restart with a small, concrete weekly target — even 3 applications and 2 messages breaks the freeze.',
        },
      ],
    })
  } else if (applyLevel === 'low' && networkLevel === 'high') {
    flags.push({
      key: 'networking_no_applying',
      label: 'Networking without applying',
      detail: `${outreachRecent} outreach messages but only ${applicationsRecent} application${applicationsRecent === 1 ? '' : 's'} in the last ${RECENT_WINDOW_DAYS} days — conversations aren't converting into submissions.`,
      causes: [
        {
          cause: 'Real networking activity, but very few actual applications — conversations are happening without turning into submitted applications.',
          fix: "Turn this week's warmest conversation into an application within 48 hours, while it's still fresh.",
        },
      ],
    })
  }

  // Pattern 5: scattershot targeting.
  if (functionFocus && functionFocus.distinct >= 3) {
    flags.push({
      key: 'scattershot',
      label: 'Scattered targeting',
      detail: `Applications span ${functionFocus.distinct} different job functions: ${functionFocus.breakdown}.`,
      causes: [
        {
          cause: 'Applying across many different types of roles dilutes the story each application tells — a resume and pitch tuned for one function reads as a mismatch for another.',
          fix: 'Narrow to the strongest 1-2 target functions for the next few weeks and tailor materials specifically to those.',
        },
      ],
    })
  }

  // Pattern 6: repeated applications to the same company.
  const repeats = companyRepeats(appliedPostings)
  if (repeats.length > 0) {
    const top = repeats[0]
    flags.push({
      key: 'company_repeat',
      label: 'Repeated applications to one company',
      detail:
        repeats.length === 1
          ? `${top.count} applications to ${top.name} with no new angle between them.`
          : `${repeats.length} companies with 3+ applications each — most notably ${top.count} to ${top.name}.`,
      causes: [
        {
          cause: 'Reapplying to the same company repeatedly rarely changes the outcome without something new — a different role type, a new contact, or a referral.',
          fix: 'Pause on this company until there is a real reason to apply again, and put that energy into new targets instead.',
        },
      ],
    })
  }

  return flags
}
