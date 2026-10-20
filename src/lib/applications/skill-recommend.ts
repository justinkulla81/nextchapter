// "What to build next": skills ranked by how often the member's own applications ask for them, how
// often their target market's open jobs that fit them ask for them (strict relevance: the board's
// strong and good fits, skill-gap-data.ts), and the posted-pay lift where we have one (the AI-skills
// pay premium, ai-skill-market.ts). Pure; tested in src/test/application-skill-snapshot.test.ts.

import type { AskedGap } from './skill-gap-summary'

export interface MarketSkill {
  term: string
  /** Best-fit employers asking for it (one vote each). */
  employers: number
  have: boolean
  ai: boolean
}

export interface PayLift {
  /** Like-for-like posted-pay premium, percent. */
  pct: number
  text: string
}

export interface SkillRecommendation {
  term: string
  ai: boolean
  applications: number
  employers: number
  payLiftPct: number | null
  score: number
  reason: string
}

// Applications are the member's own evidence; the market is the wider view; pay breaks ties.
export const WEIGHTS = { applications: 0.5, market: 0.35, pay: 0.15 } as const
/** A pay lift at or above this counts in full. */
const PAY_FULL_PCT = 30
export const TOP_RECOMMENDATIONS = 3

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function rankSkillRecommendations(input: {
  appGaps: AskedGap[]
  totalApplications: number
  market: MarketSkill[]
  marketEmployers: number
  payLift: (term: string, ai: boolean) => PayLift | null
  limit?: number
}): SkillRecommendation[] {
  const byKey = new Map<string, { term: string; ai: boolean; applications: number; employers: number; inferredOnly: boolean }>()
  for (const g of input.appGaps) byKey.set(g.term.toLowerCase(), { term: g.term, ai: g.ai, applications: g.applications, employers: 0, inferredOnly: g.inferredOnly })
  for (const m of input.market) {
    if (m.have) continue
    const k = m.term.toLowerCase()
    const e = byKey.get(k) ?? { term: m.term, ai: m.ai, applications: 0, employers: 0, inferredOnly: false }
    e.employers = m.employers
    e.ai = e.ai || m.ai
    byKey.set(k, e)
  }
  const apps = Math.max(1, input.totalApplications)
  const emps = Math.max(1, input.marketEmployers)
  const scored = [...byKey.values()].map((e) => {
    const lift = input.payLift(e.term, e.ai)
    const score =
      WEIGHTS.applications * Math.min(1, e.applications / apps) +
      WEIGHTS.market * Math.min(1, e.employers / emps) +
      WEIGHTS.pay * (lift ? Math.min(1, Math.max(0, lift.pct) / PAY_FULL_PCT) : 0)
    const parts: string[] = []
    if (e.applications > 0)
      parts.push(
        e.inferredOnly
          ? `${e.applications} of your ${plural(input.totalApplications, 'application')} were for roles that usually ask for it`
          : `${e.applications} of your ${plural(input.totalApplications, 'application')} asked for it`,
      )
    if (e.employers > 0) parts.push(`${e.employers} of ${plural(input.marketEmployers, 'employer')} hiring for roles that fit you ask for it`)
    let reason = parts.length ? `${parts.join(', and ')}.` : ''
    if (lift) reason = `${reason} ${lift.text}`.trim()
    return { term: e.term, ai: e.ai, applications: e.applications, employers: e.employers, payLiftPct: lift?.pct ?? null, score: Math.round(score * 1000) / 1000, reason }
  })
  return scored
    .filter((s) => s.applications > 0 || s.employers > 0)
    .sort((a, b) => b.score - a.score || b.applications - a.applications || a.term.localeCompare(b.term))
    .slice(0, input.limit ?? TOP_RECOMMENDATIONS)
}
