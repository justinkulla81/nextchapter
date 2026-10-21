import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getActiveCourses } from '@/lib/learning/courses'
import { loadMemberSkillGapByKind } from '@/lib/jobs/skill-gap-data'
import { courseForSkill, loadApplicationGapSummary, payLiftFor } from './skill-snapshot-data'
import { rankSkillRecommendations, type SkillRecommendation } from './skill-recommend'
import type { ApplicationGapSummary } from './skill-gap-summary'
import type { ApplicationMatchData } from '@/components/dashboard/ApplicationMatchView'

// The member's one source of truth for application gaps and what to build next. Search Strategy shows it
// in full; Learning orders its courses by it; Market Reality and explain-my-gaps cite the same gaps.

export interface ApplicationSkillPlan {
  summary: ApplicationGapSummary
  recommendations: (SkillRecommendation & { course: { title: string; url: string } | null })[]
}

/** Gaps from applications plus the ranked recommendations (applications, the member's best-fit market, AI pay lift). Null when there are no snapshots. */
export const loadApplicationSkillPlan = cache(async (candidateId: string): Promise<ApplicationSkillPlan | null> => {
  const summary = await loadApplicationGapSummary(candidateId)
  if (!summary) return null
  try {
    const [profile, market, catalog] = await Promise.all([
      prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { targetFunction: true, primaryFunction: true } }),
      loadMemberSkillGapByKind(candidateId),
      getActiveCourses(),
    ])
    const fn = profile?.targetFunction ?? profile?.primaryFunction ?? null
    const recs = rankSkillRecommendations({
      appGaps: summary.gaps.length ? summary.gaps : [],
      totalApplications: summary.applications,
      market: (market?.rows ?? []).map((r) => ({ term: r.term, employers: r.employers, have: r.have, ai: r.ai })),
      marketEmployers: market?.employersWithSkillData ?? 0,
      payLift: (term, ai) => payLiftFor(term, ai, fn),
    })
    return {
      summary,
      recommendations: recs.map((r) => {
        const c = courseForSkill(r.term, catalog)
        return { ...r, course: c ? { title: c.title, url: c.url } : null }
      }),
    }
  } catch (err) {
    console.error('[application-skill-plan] recommendations failed', candidateId, err)
    return { summary, recommendations: [] }
  }
})

/** The plain data the Search Strategy section renders. */
export async function loadApplicationMatchData(candidateId: string): Promise<ApplicationMatchData | null> {
  const plan = await loadApplicationSkillPlan(candidateId)
  if (!plan) return null
  const catalog = await getActiveCourses().catch(() => [])
  const { summary } = plan
  return {
    applications: summary.applications,
    fromPostings: summary.fromPostings,
    inferred: summary.inferred,
    matchPct: summary.matchPct,
    matchPctAtApply: summary.matchPctAtApply,
    trend: summary.trend,
    gaps: summary.gaps.map((g) => {
      const c = courseForSkill(g.term, catalog)
      return { term: g.term, applications: g.applications, recent: g.recent, inferredOnly: g.inferredOnly, course: c ? { title: c.title, url: c.url } : null }
    }),
    bestLine: summary.best?.text ?? null,
    recommendations: plan.recommendations.map((r) => ({ term: r.term, reason: r.reason, course: r.course })),
  }
}
