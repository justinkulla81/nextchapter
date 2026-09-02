import 'server-only'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { searchAdzunaJobs } from '@/lib/market/adzuna'
import { lookupBlsTrend } from '@/lib/market/bls'
import { lookupSocCode } from '@/lib/market/soc-codes'
import type { MarketConditions, MarketConditionsInput } from '@/lib/market/types'
import { LEVEL_GROUP_SYNONYMS } from '@/lib/jobs/level-groups'

const CACHE_TTL_MS = 48 * 60 * 60 * 1000

// after() throws "called outside a request scope" when getMarketConditions
// runs from anywhere that isn't a real Next.js request (a standalone script,
// a backfill) — a real, pre-existing gap surfaced while spot-checking the
// Market Reality Grade recalibration against real candidates from a script.
// The background refresh is a pure optimization (stale-while-revalidate);
// skipping it outside a request context just means the cache refreshes on
// the next real request instead, which is correct, not a silent bug.
function scheduleBackgroundRefresh(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    // No request scope to attach to — nothing to do; the next real request
    // for this role/location/industry will trigger its own refresh.
  }
}

function normalize(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

function buildCacheKey(input: MarketConditionsInput): { roleQuery: string; location: string; industry: string } {
  const occupation = lookupSocCode(input.primaryFunction)
  const baseRoleQuery = normalize(input.roleType) || occupation?.title.toLowerCase() || 'general'
  // Fold levelGroup into the cache key — a Director-level and VP-level
  // candidate targeting the same stripped function term must not share a
  // cached count, since the level-synonym breadth (what_or) makes the
  // actual Adzuna query genuinely different between them.
  const excludeSuffix = input.whatExclude && input.whatExclude.length > 0 ? '__excl' : ''
  const roleQuery = (input.levelGroup ? `${baseRoleQuery}__${input.levelGroup}` : baseRoleQuery) + excludeSuffix
  const location =
    input.city && input.state
      ? `${normalize(input.city)}, ${normalize(input.state)}`
      : normalize(input.state) || 'us'
  const industry = normalize(input.targetIndustries?.[0] ?? null)
  return { roleQuery, location, industry }
}

async function refreshMarketConditions(
  input: MarketConditionsInput,
  roleQuery: string,
  location: string,
  industry: string
): Promise<void> {
  const occupation = lookupSocCode(input.primaryFunction)
  const adzunaWhat = input.roleType || occupation?.title || input.primaryFunction || 'jobs'
  const adzunaWhere = input.city ? `${input.city} ${input.state ?? ''}`.trim() : input.state
  const industryTerm = input.targetIndustries?.[0] ?? null
  const whatOr = input.levelGroup ? LEVEL_GROUP_SYNONYMS[input.levelGroup] : undefined
  const whatExclude = input.whatExclude

  // The ideal (title AND industry AND geo) count is only meaningful when
  // both a location and a target industry are known — without geo it can't
  // claim to be "near you," and without an industry term what_and would
  // just duplicate the broader query.
  const canComputeIdeal = !!adzunaWhere && !!industryTerm

  const [adzunaResult, idealResult, blsResult] = await Promise.all([
    searchAdzunaJobs(adzunaWhat, adzunaWhere ?? null, 50, null, whatOr, whatExclude),
    canComputeIdeal
      ? searchAdzunaJobs(adzunaWhat, adzunaWhere, 50, industryTerm, whatOr, whatExclude)
      : Promise.resolve({
          status: 'not_configured' as const,
          count: null,
          error: 'Need both a location and a target industry to compute an ideal-match count.',
        }),
    lookupBlsTrend(input.primaryFunction, input.city, input.state),
  ])

  // A failed refetch (rate-limited, timed out, etc.) must never clobber a
  // perfectly good previously-cached count with null — real production bug:
  // batching ~15 candidates' background refreshes in the same cron run blew
  // through Adzuna's rate limit, and the resulting 429s were silently
  // overwriting good cached counts with null/error on every affected
  // candidate. On the `update` path, only touch the fields whose fetch
  // actually succeeded this time; a failure leaves the existing cached
  // value in place (still served as stale-while-revalidate) instead of
  // degrading a working number into "no data."
  const adzunaFields =
    adzunaResult.status === 'success' ? { adzunaCount: adzunaResult.count, adzunaError: adzunaResult.error } : {}
  const idealFields =
    idealResult.status === 'success'
      ? { adzunaIdealCount: idealResult.count, adzunaIdealError: idealResult.error }
      : {}

  await prisma.marketConditionsSnapshot.upsert({
    where: { roleQuery_location_industry: { roleQuery, location, industry } },
    create: {
      roleQuery,
      location,
      industry,
      adzunaCount: adzunaResult.count,
      adzunaError: adzunaResult.error,
      adzunaIdealCount: idealResult.count,
      adzunaIdealError: idealResult.error,
      blsSocCode: blsResult.socCode,
      blsAreaCode: blsResult.areaCode,
      blsYoyChangePct: blsResult.yoyChangePct,
      blsError: blsResult.error,
    },
    update: {
      ...adzunaFields,
      ...idealFields,
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
  const { roleQuery, location, industry } = buildCacheKey(input)

  const cached = await prisma.marketConditionsSnapshot.findUnique({
    where: { roleQuery_location_industry: { roleQuery, location, industry } },
  })

  if (cached) {
    const isFresh = Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS
    if (!isFresh) {
      scheduleBackgroundRefresh(() => refreshMarketConditions(input, roleQuery, location, industry))
    }
    return {
      dataAvailable: cached.adzunaCount !== null || cached.blsYoyChangePct !== null,
      adzunaCount: cached.adzunaCount,
      adzunaError: cached.adzunaError,
      adzunaIdealCount: cached.adzunaIdealCount,
      adzunaIdealError: cached.adzunaIdealError,
      blsSocCode: cached.blsSocCode,
      blsAreaCode: cached.blsAreaCode,
      blsYoyChangePct: cached.blsYoyChangePct,
      blsError: cached.blsError,
      fromCache: true,
    }
  }

  scheduleBackgroundRefresh(() => refreshMarketConditions(input, roleQuery, location, industry))
  return {
    dataAvailable: false,
    adzunaCount: null,
    adzunaError: null,
    adzunaIdealCount: null,
    adzunaIdealError: null,
    blsSocCode: null,
    blsAreaCode: null,
    blsYoyChangePct: null,
    blsError: null,
    fromCache: false,
  }
}
