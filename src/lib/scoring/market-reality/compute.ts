// Orchestrator for the three non-Record components — Market Reality Grade
// 2.0 Phase 3. Writes MarketRealityComponentScore's four raw component
// scores. Deliberately does NOT touch compositeScore/grade/drivingComponent/
// strongestComponent — that weighting and band-mapping logic is Phase 4.
// Not yet wired into any live route; callable standalone for the Phase 9
// fixture harness, same as src/lib/scoring/resume-analysis/compute.ts.

import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeEvidenceComponent } from './evidence'
import { computeMarketComponent } from './market'
import { computeChannelsComponent } from './channels'

export async function computeMarketRealityComponents(candidateId: string): Promise<void> {
  const [latestResumeAnalysis, evidence, market, channels] = await Promise.all([
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { composite: true, createdAt: true },
    }),
    computeEvidenceComponent(candidateId),
    computeMarketComponent(candidateId),
    computeChannelsComponent(candidateId),
  ])

  const now = new Date()

  await prisma.marketRealityComponentScore.upsert({
    where: { candidateId },
    create: {
      candidateId,
      recordScore: latestResumeAnalysis?.composite ?? null,
      evidenceScore: evidence.score,
      marketScore: market.score,
      channelsScore: channels.score,
      evidenceDrivers: evidence.drivers as unknown as Prisma.InputJsonValue,
      marketDrivers: market.drivers as unknown as Prisma.InputJsonValue,
      channelsDrivers: channels.drivers as unknown as Prisma.InputJsonValue,
      recordComputedAt: latestResumeAnalysis?.createdAt ?? null,
      evidenceComputedAt: now,
      marketComputedAt: now,
      channelsComputedAt: now,
    },
    update: {
      recordScore: latestResumeAnalysis?.composite ?? null,
      evidenceScore: evidence.score,
      marketScore: market.score,
      channelsScore: channels.score,
      evidenceDrivers: evidence.drivers as unknown as Prisma.InputJsonValue,
      marketDrivers: market.drivers as unknown as Prisma.InputJsonValue,
      channelsDrivers: channels.drivers as unknown as Prisma.InputJsonValue,
      recordComputedAt: latestResumeAnalysis?.createdAt ?? null,
      evidenceComputedAt: now,
      marketComputedAt: now,
      channelsComputedAt: now,
    },
  })
}
