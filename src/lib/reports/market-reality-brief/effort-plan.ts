// How much search activity this market takes. Pure arithmetic over the
// per-attempt interview probability the Market Reality engine already
// persists (scoring/market-reality/probability.ts) — the same number the
// grade is built on, so the volumes here can never disagree with it.
//
// Every figure is an estimate and is labeled as one where it renders. The
// plan states what is typically required, not a promise of an outcome.

/** Planning assumption: first-round interviews it takes to produce one offer at this level. */
export const INTERVIEWS_PER_OFFER = 5
/** The window the weekly pace is quoted over. */
export const PLAN_WEEKS = 12

export interface EffortRoute {
  key: 'applications' | 'networking' | 'balanced'
  label: string
  applications: number
  conversations: number
  applicationsPerWeek: number
  conversationsPerWeek: number
}

export interface EffortPace {
  applicationsPerWeek: number
  conversationsPerWeek: number
  /** Interviews expected over PLAN_WEEKS at that pace. */
  expectedInterviews: number
  /** expectedInterviews as a share of INTERVIEWS_PER_OFFER. */
  coverage: number
  activityObserved: boolean
}

export interface EffortPlan {
  applicationsPerInterview: number
  conversationsPerInterview: number
  interviewsNeeded: number
  routes: EffortRoute[]
  pace: EffortPace
}

export interface EffortPlanInput {
  perAttemptProbability: number
  /** Conversations count as this many applications (scoring/market-reality/attempts.ts NETWORKING_WEIGHT). */
  networkingWeight: number
  /** Last four weeks of real activity, averaged per week. */
  applicationsPerWeek: number
  conversationsPerWeek: number
}

export function buildEffortPlan(input: EffortPlanInput): EffortPlan {
  const p = input.perAttemptProbability
  const applicationsPerInterview = Math.max(1, Math.round(1 / p))
  const conversationsPerInterview = Math.max(1, Math.round(applicationsPerInterview / input.networkingWeight))
  const n = INTERVIEWS_PER_OFFER

  const route = (key: EffortRoute['key'], label: string, interviewsFromApps: number, interviewsFromNetwork: number): EffortRoute => {
    const applications = Math.ceil(interviewsFromApps * applicationsPerInterview)
    const conversations = Math.ceil(interviewsFromNetwork * conversationsPerInterview)
    return {
      key,
      label,
      applications,
      conversations,
      applicationsPerWeek: Math.ceil(applications / PLAN_WEEKS),
      conversationsPerWeek: Math.ceil(conversations / PLAN_WEEKS),
    }
  }

  const routes = [
    route('applications', 'Applications only', n, 0),
    route('networking', 'Conversations only', 0, n),
    route('balanced', 'Balanced', n / 2, n / 2),
  ]

  const expectedInterviews = PLAN_WEEKS * (input.applicationsPerWeek * p + input.conversationsPerWeek * p * input.networkingWeight)
  const pace: EffortPace = {
    applicationsPerWeek: round1(input.applicationsPerWeek),
    conversationsPerWeek: round1(input.conversationsPerWeek),
    expectedInterviews: round1(expectedInterviews),
    coverage: expectedInterviews / n,
    activityObserved: input.applicationsPerWeek > 0 || input.conversationsPerWeek > 0,
  }

  return { applicationsPerInterview, conversationsPerInterview, interviewsNeeded: n, routes, pace }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export type Competitiveness = 'favorable' | 'moderate' | 'competitive' | 'highly_competitive'

/** How hard this market is for this candidate, read from applications per interview. Bands follow probability.ts. */
export function competitivenessFor(applicationsPerInterview: number): { key: Competitiveness; label: string } {
  if (applicationsPerInterview <= 12) return { key: 'favorable', label: 'Favorable' }
  if (applicationsPerInterview <= 33) return { key: 'moderate', label: 'Moderate' }
  if (applicationsPerInterview <= 100) return { key: 'competitive', label: 'Competitive' }
  return { key: 'highly_competitive', label: 'Highly competitive' }
}
