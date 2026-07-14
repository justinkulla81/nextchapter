import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchAdzunaJobs } from '@/lib/market/adzuna'
import { lookupBlsTrend } from '@/lib/market/bls'
import { lookupSocCode } from '@/lib/market/soc-codes'
import type { MarketConditions, MarketConditionsInput } from '@/lib/market/types'

const CACHE_TTL_MS = 48 * 60 * 60 * 1000

function normalize(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

function buildCacheKey(input: MarketConditionsInput): { roleQuery: string; location: string } {
  const occupation = lookupSocCode(input.primaryFunction)
  const roleQuery = normalize(input.roleType) || occupation?.title.toLowerCase() || 'general'
  const location =
    input.city && input.state
      ? `${normalize(input.city)}, ${normalize(input.state)}`
      : normalize(input.state) || 'us'
  return { roleQuery, location }
}

export async function getMarketConditions(input: MarketConditionsInput): Promise<MarketConditions> {
  const { roleQuery, location } = buildCacheKey(input)

  const cached = await prisma.marketConditionsSnapshot.findUnique({
    where: { roleQuery_location: { roleQuery, location } },
  })

  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return {
      dataAvailable: cached.adzunaCount !== null || cached.blsYoyChangePct !== null,
      adzunaCount: cached.adzunaCount,
      adzunaError: cached.adzunaError,
      blsSocCode: cached.blsSocCode,
      blsAreaCode: cached.blsAreaCode,
      blsYoyChangePct: cached.blsYoyChangePct,
      blsError: cached.blsError,
      fromCache: true,
    }
  }

  const occupation = lookupSocCode(input.primaryFunction)
  const adzunaWhat = input.roleType || occupation?.title || input.primaryFunction || 'jobs'
  const adzunaWhere = input.city ? `${input.city} ${input.state ?? ''}`.trim() : input.state

  const [adzunaResult, blsResult] = await Promise.all([
    searchAdzunaJobs(adzunaWhat, adzunaWhere ?? null),
    lookupBlsTrend(input.primaryFunction, input.city, input.state),
  ])

  const snapshot = await prisma.marketConditionsSnapshot.upsert({
    where: { roleQuery_location: { roleQuery, location } },
    create: {
      roleQuery,
      location,
      adzunaCount: adzunaResult.count,
      adzunaError: adzunaResult.error,
      blsSocCode: blsResult.socCode,
      blsAreaCode: blsResult.areaCode,
      blsYoyChangePct: blsResult.yoyChangePct,
      blsError: blsResult.error,
    },
    update: {
      adzunaCount: adzunaResult.count,
      adzunaError: adzunaResult.error,
      blsSocCode: blsResult.socCode,
      blsAreaCode: blsResult.areaCode,
      blsYoyChangePct: blsResult.yoyChangePct,
      blsError: blsResult.error,
      fetchedAt: new Date(),
    },
  })

  return {
    dataAvailable: snapshot.adzunaCount !== null || snapshot.blsYoyChangePct !== null,
    adzunaCount: snapshot.adzunaCount,
    adzunaError: snapshot.adzunaError,
    blsSocCode: snapshot.blsSocCode,
    blsAreaCode: snapshot.blsAreaCode,
    blsYoyChangePct: snapshot.blsYoyChangePct,
    blsError: snapshot.blsError,
    fromCache: false,
  }
}
