// Market component — Master Build Script §3.5: "Your Market is a cap, not
// a weight." Never weighted into the composite directly (composite.ts
// applies it as a one-band cap on the weighted-four composite). Three
// constraints, differing in kind, scored as separate legs and combined by
// taking the worst — never blended into one number that hides which one is
// binding, since §3.5 requires the report to state cause and never imply
// the constraint is wrong:
//   1. Work authorization — binary/near-absolute (eligibility, not
//      difficulty): no authorization + no sponsorship in range.
//   2. Compensation floor — continuous: a floor above band for most roles.
//   3. Geography/mobility — continuous: role scarcity for the stated
//      target and location (Voice/Intake Spec §3.1-3.3), "current volume
//      against a trailing baseline for the same target profile." Sourced
//      from the existing live posting-volume cache (src/lib/market/
//      index.ts, Adzuna + BLS) rather than a new crawler — this leg's job
//      is to snapshot that cache weekly per candidate
//      (MarketDifficultySnapshot, append-only) and turn a smoothed reading
//      into a 0-100 score. Smoothing is the whole point: a score that
//      twitches week to week reads as a stock ticker and destroys
//      confidence (§3.3).

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { buildMarketRoleQuery } from '@/lib/jobs/level-groups'
import type { ComponentComputation } from './types'

interface MarketLeg {
  score: number
  drivers: string[]
}

// Work authorization can shape plan/matching but must never become a
// filter that hides roles or silently deprioritizes a candidate to an
// employer (§3.5 guardrail) — this leg only ever affects the displayed
// Market score/prose, nothing else reads it.
function workAuthorizationLeg(workAuthorization: string | null): MarketLeg {
  if (workAuthorization === 'need_sponsorship') {
    return {
      score: 35,
      drivers: [
        'Roles that require visa sponsorship narrow your options — most employers don\'t sponsor.',
        'This isn\'t about your background — it\'s about which employers can legally hire you. Sponsoring and cap-exempt employers (many universities, nonprofits, and larger companies) are the path, and we can help you target them.',
      ],
    }
  }
  // 'us_citizen' | 'permanent_resident' | 'work_authorized_no_sponsorship' |
  // 'other' | null — no constraint, or genuinely unknown (never guess into
  // a penalty for ambiguous or unanswered data).
  return { score: 90, drivers: [] }
}

// Comp floor leg — approximate by design: without a live comp-by-posting
// dataset to compare against, this can't yet say "above band for 80% of
// roles" the way §3.5's worked example does. What it can say honestly is
// whether the candidate has set a firm (non-flexible) floor at all, which
// is itself the lever that moves this leg.
function compFloorLeg(targetCompMin: number | null, compFlexible: boolean): MarketLeg {
  if (targetCompMin !== null && !compFlexible) {
    return {
      score: 60,
      drivers: [
        `A firm minimum of $${targetCompMin.toLocaleString()} rules out some roles outright.`,
        'Marking yourself open on comp — even a little — widens what you\'re matched against, without committing you to accept less.',
      ],
    }
  }
  return { score: 90, drivers: [] }
}

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

async function geographyLeg(candidateId: string, candidate: {
  targetRoleType: string | null
  primaryFunction: string | null
  currentCity: string | null
  currentState: string | null
}): Promise<MarketLeg> {
  const { roleType, levelGroup, whatExclude } = buildMarketRoleQuery(candidate.targetRoleType, candidate.primaryFunction)
  const conditions = await getMarketConditions({
    roleType,
    primaryFunction: candidate.primaryFunction,
    city: candidate.currentCity,
    state: candidate.currentState,
    levelGroup,
    whatExclude,
  })

  const targetRoleQuery =
    (normalize(roleType) || normalize(candidate.primaryFunction) || 'general') +
    (levelGroup ? `__${levelGroup}` : '') +
    (whatExclude ? '__excl' : '')
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

// Industry-narrowed leg — Market Reality Grade recalibration: the user
// asked for "small size of their target industry/function" to penalize
// specifically, and the codebase already computes exactly this number
// (getMarketConditions's adzunaIdealCount, role+industry+geo) — it was just
// never read into the Market score, only used in the market-digest email.
// Only contributes when the candidate has a stated target industry; a
// candidate with no target industry gets no leg here at all rather than a
// fabricated neutral one.
async function industryLeg(candidateId: string, candidate: {
  targetRoleType: string | null
  primaryFunction: string | null
  currentCity: string | null
  currentState: string | null
  targetIndustries: string[]
}): Promise<MarketLeg | null> {
  const targetIndustry = candidate.targetIndustries[0]
  if (!targetIndustry) return null

  const { roleType, levelGroup, whatExclude } = buildMarketRoleQuery(candidate.targetRoleType, candidate.primaryFunction)
  const conditions = await getMarketConditions({
    roleType,
    primaryFunction: candidate.primaryFunction,
    city: candidate.currentCity,
    state: candidate.currentState,
    targetIndustries: candidate.targetIndustries,
    levelGroup,
    whatExclude,
  })

  // Must match geographyLeg's own targetRoleQuery exactly (level-group/
  // exclude suffixes included) — this leg's history lookup below depends
  // on it, since both legs read/write the same weekly MarketDifficultySnapshot row.
  const targetRoleQuery =
    (normalize(roleType) || normalize(candidate.primaryFunction) || 'general') +
    (levelGroup ? `__${levelGroup}` : '') +
    (whatExclude ? '__excl' : '')
  const location = candidate.currentCity
    ? `${normalize(candidate.currentCity)}, ${normalize(candidate.currentState)}`
    : normalize(candidate.currentState) || 'us'
  const weekOf = getMondayOfWeek(new Date())

  if (conditions.dataAvailable && conditions.adzunaIdealCount !== null) {
    // updateMany, never upsert — this leg has no general postingCount value
    // to satisfy that column's NOT NULL constraint on a fresh row, so it
    // only ever updates the row geographyLeg's own upsert already created
    // for this candidate+week (geographyLeg runs first in
    // computeMarketComponent below). Updates zero rows harmlessly if that
    // hasn't happened yet this week.
    await prisma.marketDifficultySnapshot.updateMany({
      where: { candidateId, weekOf },
      data: { idealPostingCount: conditions.adzunaIdealCount },
    })
  }

  const history = await prisma.marketDifficultySnapshot.findMany({
    where: { candidateId, targetRoleQuery, location, idealPostingCount: { not: null } },
    orderBy: { weekOf: 'desc' },
    take: TRAILING_WEEKS,
  })

  if (history.length === 0) {
    return {
      score: 50,
      drivers: [`Not enough market data yet to estimate role scarcity within ${targetIndustry} specifically — check back in a few days.`],
    }
  }

  const smoothedCount = Math.round(
    history.reduce((sum, h) => sum + (h.idealPostingCount as number), 0) / history.length
  )
  const score = postingCountToScore(smoothedCount)
  const roleLabel = candidate.targetRoleType || candidate.primaryFunction || 'this target'

  return {
    score,
    drivers: [`Roughly ${smoothedCount} open roles matching "${roleLabel}" specifically within ${targetIndustry} right now.`],
  }
}

export async function computeMarketComponent(candidateId: string): Promise<ComponentComputation> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      targetRoleType: true,
      primaryFunction: true,
      currentCity: true,
      currentState: true,
      workAuthorization: true,
      targetCompMin: true,
      compFlexible: true,
      targetIndustries: true,
    },
  })

  // geographyLeg runs before industryLeg — its upsert is what creates this
  // week's MarketDifficultySnapshot row, which industryLeg's updateMany
  // depends on already existing.
  const geography = await geographyLeg(candidateId, candidate)
  const industry = await industryLeg(candidateId, candidate)

  const legs = [
    workAuthorizationLeg(candidate.workAuthorization),
    compFloorLeg(candidate.targetCompMin, candidate.compFlexible),
    geography,
    ...(industry ? [industry] : []),
  ]

  // Take the worst leg, never blend — §3.5: the three constraints differ
  // in kind, and a report that averages "no sponsorship" against "roles
  // are plentiful" would bury the one thing actually blocking the
  // candidate. Ties go to whichever leg sorts first (work auth, then comp,
  // then geography) since that's the order §3.5 itself lists them in.
  const binding = legs.reduce((worst, leg) => (leg.score < worst.score ? leg : worst))

  return binding
}
