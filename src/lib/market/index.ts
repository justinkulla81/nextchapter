import 'server-only'
import { after } from 'next/server'
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

async function refreshMarketConditions(
  input: MarketConditionsInput,
  roleQuery: string,
  location: string
): Promise<void> {
  const occupation = lookupSocCode(input.primaryFunction)
  const adzunaWhat = input.roleType || occupation?.title || input.primaryFunction || 'jobs'
  const adzunaWhere = input.city ? `${input.city} ${input.state ?? ''}`.trim() : input.state

  const [adzunaResult, blsResult] = await Promise.all([
    searchAdzunaJobs(adzunaWhat, adzunaWhere ?? null),
    lookupBlsTrend(input.primaryFunction, input.city, input.state),
  ])

  await prisma.marketConditionsSnapshot.upsert({
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
}

// Stale-while-revalidate: a stale cache hit is served immediately (still
// good enough — job-posting counts and BLS trends don't meaningfully shift
// hour to hour) while a fresh fetch runs in the background via after() to
// update the cache for next time. A true cache miss (this role/location
// combo has never been fetched) has nothing to serve, so it returns
// "no data" immediately and lets the same after() populate the cache for
// the next request — previously this awaited two live external API calls
// (Adzuna + BLS) inline, blocking whatever page called it.
export async function getMarketConditions(input: MarketConditionsInput): Promise<MarketConditions> {
  const { roleQuery, location } = buildCacheKey(input)

  const cached = await prisma.marketConditionsSnapshot.findUnique({
    where: { roleQuery_location: { roleQuery, location } },
  })

  if (cached) {
    const isFresh = Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS
    if (!isFresh) {
      after(() => refreshMarketConditions(input, roleQuery, location))
    }
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

  after(() => refreshMarketConditions(input, roleQuery, location))
  return {
    dataAvailable: false,
    adzunaCount: null,
    adzunaError: null,
    blsSocCode: null,
    blsAreaCode: null,
    blsYoyChangePct: null,
    blsError: null,
    fromCache: false,
  }
}
