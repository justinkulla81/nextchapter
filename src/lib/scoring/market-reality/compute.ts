// Orchestrator for the three non-Experience/Resume components — Market
// Reality Grade 2.0 Phase 3, restructured per Master Build Script §3.1:
// Evidence, Market, and Effort (renamed from Channels). Writes
// MarketRealityComponentScore's five raw component scores (Experience/
// Resume come from the latest ResumeAnalysis row; this orchestrator only
// computes the other three). Deliberately does NOT touch
// compositeScore/grade/drivingComponent/strongestComponent — that
// weighting, cap, and band-mapping logic is composite.ts. Not yet wired
// into any live route; callable standalone for the fixture harness (§16),
// same as src/lib/scoring/resume-analysis/compute.ts.

import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeEvidenceComponent } from './evidence'
import { computeMarketComponent } from './market'
import { computeEffortComponent } from './effort'

export async function computeMarketRealityComponents(candidateId: string): Promise<void> {
  const [latestResumeAnalysis, evidence, market, effort] = await Promise.all([
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { experienceScore: true, resumeScore: true, createdAt: true },
    }),
    computeEvidenceComponent(candidateId),
    computeMarketComponent(candidateId),
    computeEffortComponent(candidateId),
  ])

  const now = new Date()

  await prisma.marketRealityComponentScore.upsert({
    where: { candidateId },
    create: {
      candidateId,
      experienceScore: latestResumeAnalysis?.experienceScore ?? null,
      resumeScore: latestResumeAnalysis?.resumeScore ?? null,
      evidenceScore: evidence.score,
      marketScore: market.score,
      effortScore: effort.score,
      evidenceDrivers: evidence.drivers as unknown as Prisma.InputJsonValue,
      marketDrivers: market.drivers as unknown as Prisma.InputJsonValue,
      effortDrivers: effort.drivers as unknown as Prisma.InputJsonValue,
      experienceComputedAt: latestResumeAnalysis?.createdAt ?? null,
      resumeComputedAt: latestResumeAnalysis?.createdAt ?? null,
      evidenceComputedAt: now,
      marketComputedAt: now,
      effortComputedAt: now,
    },
    update: {
      experienceScore: latestResumeAnalysis?.experienceScore ?? null,
      resumeScore: latestResumeAnalysis?.resumeScore ?? null,
      evidenceScore: evidence.score,
      marketScore: market.score,
      effortScore: effort.score,
      evidenceDrivers: evidence.drivers as unknown as Prisma.InputJsonValue,
      marketDrivers: market.drivers as unknown as Prisma.InputJsonValue,
      effortDrivers: effort.drivers as unknown as Prisma.InputJsonValue,
      experienceComputedAt: latestResumeAnalysis?.createdAt ?? null,
      resumeComputedAt: latestResumeAnalysis?.createdAt ?? null,
      evidenceComputedAt: now,
      marketComputedAt: now,
      effortComputedAt: now,
    },
  })
}
