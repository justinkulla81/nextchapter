import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeEvidence, memberTier, type EvidenceResult, type MemberTier } from './score'
import { aiSampleChecks, AI_SAMPLE_TYPES } from './ai-work-samples'

export interface MemberEvidence extends EvidenceResult {
  candidatePlus: boolean
  verified: boolean
  tier: MemberTier
}

/** Evidence for many members in four grouped reads (no Candidate+ check). */
export async function loadEvidenceMany(candidateIds: string[]): Promise<Map<string, EvidenceResult>> {
  const ids = [...new Set(candidateIds)]
  const out = new Map<string, EvidenceResult>()
  if (ids.length === 0) return out
  const [refs, samples, aiSamples, imports, clientReviews] = await Promise.all([
    prisma.reference.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids }, status: 'COMPLETED' }, _count: { _all: true } }),
    prisma.workSample.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids }, sampleType: { notIn: AI_SAMPLE_TYPES } }, _count: { _all: true } }),
    // AI work samples are scored on their proof-map checks (ai-work-samples.ts).
    prisma.workSample.findMany({
      where: { candidateId: { in: ids }, sampleType: { in: AI_SAMPLE_TYPES } },
      select: { candidateId: true, sampleType: true, aiDetails: true, aiToolsUsed: true, beforeMetric: true, afterMetric: true, externalUrl: true },
    }),
    prisma.externalReviewStat.findMany({
      where: { candidateId: { in: ids }, status: { not: 'REJECTED' } },
      select: { candidateId: true, rating: true, reviewCount: true, status: true },
    }),
    prisma.clientReview.findMany({ where: { candidateId: { in: ids }, status: 'PUBLISHED' }, select: { candidateId: true, rating: true } }),
  ])
  const refCount = new Map(refs.map((r) => [r.candidateId, r._count._all]))
  const sampleCount = new Map(samples.map((r) => [r.candidateId, r._count._all]))
  for (const id of ids) {
    out.set(
      id,
      computeEvidence({
        completedReferences: refCount.get(id) ?? 0,
        portfolioItems: sampleCount.get(id) ?? 0,
        importedReviews: imports.filter((r) => r.candidateId === id),
        aiSamples: aiSamples
          .filter((w) => w.candidateId === id)
          .map((w) => aiSampleChecks(w))
          .filter((c) => c !== null)
          .map((c) => ({ hasMetric: c.hasMetric, checksPassed: c.passed.length })),
        clientReviewRatings: clientReviews.filter((r) => r.candidateId === id).map((r) => r.rating),
      })
    )
  }
  return out
}

/** One member's tier and evidence. Cached per request. */
export const getMemberEvidence = cache(async (candidateId: string): Promise<MemberEvidence> => {
  const [plus, evidenceMap] = await Promise.all([isDossierUnlocked(candidateId), loadEvidenceMany([candidateId])])
  const evidence = evidenceMap.get(candidateId)!
  const tier = memberTier(plus.unlocked, evidence)
  return { ...evidence, candidatePlus: plus.unlocked, verified: tier === 'CANDIDATE_PLUS_VERIFIED', tier }
})

/**
 * Candidate+ status and evidence for a list of members, for recruiter and
 * employer surfaces. Candidate+ is the only gate for being shown at all; the
 * evidence decides order and the badge.
 */
export async function loadVisibilityMany(candidateIds: string[]): Promise<Map<string, MemberEvidence>> {
  const ids = [...new Set(candidateIds)]
  const [plus, evidence] = await Promise.all([Promise.all(ids.map((id) => isDossierUnlocked(id))), loadEvidenceMany(ids)])
  const out = new Map<string, MemberEvidence>()
  ids.forEach((id, i) => {
    const e = evidence.get(id)!
    const tier = memberTier(plus[i].unlocked, e)
    out.set(id, { ...e, candidatePlus: plus[i].unlocked, verified: tier === 'CANDIDATE_PLUS_VERIFIED', tier })
  })
  return out
}
