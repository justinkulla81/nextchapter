import 'server-only'
import { prisma } from '@/lib/prisma'
import { statesFromLocation } from '@/lib/pay/market-pay'
import type { PayBenchmarkRow } from '@/lib/outcomes/pay-change-estimate'
import { ROLES, SOURCES, detectSourceRole } from './pivot-map'
import { isPeopleEnergy, rankPivots, type MarketContext, type MemberPivotInput, type PivotPathsResult } from './scoring'

const WARN_DAYS = 90

export interface PivotProfile {
  id: string
  resumeLatestJobTitle: string | null
  primaryFunction: string | null
  targetFunction: string | null
  highestLevelReached: string | null
  isPivoting: boolean
  currentState: string | null
  remotePreference: string | null
  openToRelocation: boolean
  resumeKeywords: string[]
  confirmedSkillsHave: string[]
  certifications: string[]
  targetCompMin: number | null
}

/** "KY", "ky" or "Kentucky" to "KY"; null when it isn't a US state. */
export function stateCode(s: string | null): string | null {
  const v = (s ?? '').trim()
  if (!v) return null
  if (/^[a-z]{2}$/i.test(v)) return statesFromLocation(v.toUpperCase()).states[0] ?? null
  return statesFromLocation(v).states[0] ?? null
}

/** The member's people-energy answer and hidden paths. Null when the table isn't there yet (deploy before DDL). */
async function loadPreference(candidateId: string) {
  try {
    return await prisma.pivotPreference.findUnique({ where: { candidateId } })
  } catch (error) {
    console.error('Pivot paths: could not read PivotPreference', error)
    return null
  }
}

async function loadCollaborationVector(candidateId: string): Promise<number | null> {
  const latest = await prisma.candidateAssessmentResponse.findFirst({
    where: { candidateId },
    orderBy: { completedAt: 'desc' },
    select: { dimensionVectors: true },
  })
  const v = (latest?.dimensionVectors as Record<string, unknown> | null)?.collaboration
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  // The archived instrument scored -2..+2; the current one -1..+1.
  return Math.abs(v) > 1 ? v / 2 : v
}

/**
 * Everything pivot paths need for one member, read narrowly: their profile
 * fields, a few dozen precomputed market rows for their state, remote and the
 * nation, WARN filings in their state, and pay benchmarks. Never scans the board.
 */
export async function loadPivotPaths(profile: PivotProfile): Promise<PivotPathsResult> {
  const state = stateCode(profile.currentState)
  const sourceKey = detectSourceRole({ title: profile.resumeLatestJobTitle, primaryFunction: profile.primaryFunction })
  const roleKeys = ['*', ...(sourceKey ? [sourceKey, ...(SOURCES.get(sourceKey)?.edges.map((e) => e.to) ?? [])] : [])]
  const fns = [...new Set(roleKeys.map((k) => ROLES.get(k)?.fn).filter((f): f is NonNullable<typeof f> => !!f))]
  const geos = ['US', 'REMOTE', ...(state ? [state] : [])]

  const [pref, collaborationVector, stats, warn, payBenchmarks, payChange] = await Promise.all([
    loadPreference(profile.id),
    loadCollaborationVector(profile.id),
    prisma.pivotMarketStat
      .findMany({
        where: { roleKey: { in: roleKeys }, geo: { in: geos } },
        select: {
          roleKey: true, geo: true, band: true, openNow: true, lowCompetitionOpen: true,
          new30: true, prior30: true, new90: true, prior90: true, payP50: true, paySample: true,
        },
      })
      .catch((error) => {
        console.error('Pivot paths: could not read market stats', error)
        return []
      }),
    state
      ? prisma.warnNotice.aggregate({
          where: {
            state,
            dismissedAt: null,
            OR: [
              { noticeDate: { gte: new Date(Date.now() - WARN_DAYS * 86_400_000) } },
              { noticeDate: null, fetchedAt: { gte: new Date(Date.now() - WARN_DAYS * 86_400_000) } },
            ],
          },
          _count: { _all: true },
          _sum: { employees: true },
        })
      : Promise.resolve(null),
    fns.length > 0
      ? prisma.payBenchmark.findMany({
          where: { fn: { in: fns }, geo: { in: geos.filter((g) => g !== 'REMOTE') } },
          select: { fn: true, seniorityGroup: true, geo: true, p50: true, sampleSize: true },
        })
      : Promise.resolve([]),
    prisma.payChangeBenchmark.findMany({ orderBy: { createdAt: 'asc' } }),
  ])

  const member: MemberPivotInput = {
    title: profile.resumeLatestJobTitle,
    primaryFunction: profile.primaryFunction,
    targetFunction: profile.targetFunction,
    highestLevelReached: profile.highestLevelReached,
    isPivoting: profile.isPivoting,
    state,
    remotePreference: profile.remotePreference,
    openToRelocation: profile.openToRelocation,
    skills: [...profile.resumeKeywords, ...profile.confirmedSkillsHave, ...profile.certifications],
    targetCompMin: profile.targetCompMin,
    peopleEnergyAnswer: isPeopleEnergy(pref?.peopleEnergy) ? pref!.peopleEnergy as MemberPivotInput['peopleEnergyAnswer'] : null,
    collaborationVector,
    dismissed: pref?.dismissedTargets ?? [],
  }
  const ctx: MarketContext = {
    stats,
    warn90: warn ? { filings: warn._count._all, employees: warn._sum.employees ?? 0 } : null,
    payBenchmarks,
    payChange: payChange.map(
      (r): PayBenchmarkRow => ({
        pathType: r.pathType,
        group: r.group,
        lowPct: r.lowPct,
        highPct: r.highPct,
        medianPct: r.medianPct,
        sampleSize: r.sampleSize,
        confidence: r.confidence,
        sourceTitle: r.sourceTitle,
        sourceUrl: r.sourceUrl,
        asOf: r.asOf,
      })
    ),
  }
  return rankPivots(member, ctx)
}

/** Select for the profile fields pivot paths read. */
export const PIVOT_PROFILE_SELECT = {
  id: true,
  resumeLatestJobTitle: true,
  primaryFunction: true,
  targetFunction: true,
  highestLevelReached: true,
  isPivoting: true,
  currentState: true,
  remotePreference: true,
  openToRelocation: true,
  resumeKeywords: true,
  confirmedSkillsHave: true,
  certifications: true,
  targetCompMin: true,
} as const
