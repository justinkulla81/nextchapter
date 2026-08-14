// Market component — role scarcity for the stated target (Voice/Intake Spec
// §3.1-3.3): "current volume against a trailing baseline for the same
// target profile." Sourced from the existing live posting-volume cache
// (src/lib/market/index.ts, Adzuna + BLS) rather than a new crawler — this
// module's only job is to snapshot that cache weekly per candidate
// (MarketDifficultySnapshot, append-only) and turn a smoothed reading into
// a 0-100 score. Smoothing is the whole point: a market score that twitches
// week to week reads as a stock ticker and destroys confidence (§3.3).

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import type { ComponentComputation } from './types'

const TRAILING_WEEKS = 6

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

// Absolute-count tiers, not percentile-based — a candidate targeting a
// scarce senior/niche role should read as scarce even in a booming overall
// market. Deliberately coarse; refined against real posting data as the
// fixture harness (Phase 9) accumulates candidates across bands.
function postingCountToScore(count: number): number {
  if (count <= 5) return 15
  if (count <= 20) return 35
  if (count <= 50) return 55
  if (count <= 150) return 75
  return 90
}

export async function computeMarketComponent(candidateId: string): Promise<ComponentComputation> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { targetRoleType: true, primaryFunction: true, currentCity: true, currentState: true },
  })

  const conditions = await getMarketConditions({
    roleType: candidate.targetRoleType,
    primaryFunction: candidate.primaryFunction,
    city: candidate.currentCity,
    state: candidate.currentState,
  })

  const targetRoleQuery = normalize(candidate.targetRoleType) || normalize(candidate.primaryFunction) || 'general'
  const location = candidate.currentCity
    ? `${normalize(candidate.currentCity)}, ${normalize(candidate.currentState)}`
    : normalize(candidate.currentState) || 'us'
  const weekOf = getMondayOfWeek(new Date())

  if (conditions.dataAvailable && conditions.adzunaCount !== null) {
    await prisma.marketDifficultySnapshot.upsert({
      where: { candidateId_weekOf: { candidateId, weekOf } },
      create: { candidateId, targetRoleQuery, location, postingCount: conditions.adzunaCount, weekOf },
      update: { targetRoleQuery, location, postingCount: conditions.adzunaCount },
    })
  }

  const history = await prisma.marketDifficultySnapshot.findMany({
    where: { candidateId, targetRoleQuery, location },
    orderBy: { weekOf: 'desc' },
    take: TRAILING_WEEKS,
  })

  if (history.length === 0) {
    // No data yet — this week's fetch may still be populating in the
    // background (getMarketConditions is stale-while-revalidate). Neutral
    // score rather than a false "very scarce" read.
    return {
      score: 50,
      drivers: ['Not enough market data yet to estimate role scarcity for this target — check back in a few days.'],
    }
  }

  const smoothedCount = Math.round(history.reduce((sum, h) => sum + h.postingCount, 0) / history.length)
  const score = postingCountToScore(smoothedCount)

  const roleLabel = candidate.targetRoleType || candidate.primaryFunction || 'this target'
  const locationLabel = candidate.currentCity ? `${candidate.currentCity}, ${candidate.currentState}` : 'this area'
  const drivers = [`Roughly ${smoothedCount} open roles matching "${roleLabel}" in ${locationLabel} right now.`]
  if (history.length >= 2) {
    const previous = history[1].postingCount
    if (previous > 0) {
      const changePct = Math.round(((smoothedCount - previous) / previous) * 100)
      if (Math.abs(changePct) >= 15) {
        drivers.push(`That's ${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct)}% from recent weeks.`)
      }
    }
  }

  return { score, drivers }
}
