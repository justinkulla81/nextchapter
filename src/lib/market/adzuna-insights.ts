import 'server-only'
import { after } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  bucketId,
  getInsight,
  locationKey,
  normalizeRoleQuery,
  resolveState,
  BUDGET_LIMITS,
  type AdzunaInsightEndpoint,
  type BudgetPeriod,
  type BudgetScope,
  type BudgetStore,
  type GetInsightOptions,
  type InsightDeps,
  type InsightKey,
  type InsightPayloads,
  type InsightResult,
  type InsightStore,
  type LiveResult,
} from '@/lib/market/adzuna-insights-core'

export * from '@/lib/market/adzuna-insights-core'

// Adzuna labor-market statistics (salary histogram, 6-month salary history,
// top hiring companies, demand by state, posting counts) for a role +
// optional US state. Every read goes through getInsight's shared Postgres
// cache (AdzunaInsightCache, refreshed at most weekly) and the global
// request budget (AdzunaApiUsage) — see adzuna-insights-core.ts for the
// rules. Adzuna's terms require crediting them wherever this data is shown:
// render <AdzunaAttribution /> next to it.

export const ADZUNA_ATTRIBUTION_URL = 'https://www.adzuna.com'

const BASE = 'https://api.adzuna.com/v1/api/jobs/us'

// ── Stores ───────────────────────────────────────────────────────────────────

const prismaStore: InsightStore = {
  async get(key) {
    const row = await prisma.adzunaInsightCache.findUnique({ where: { endpoint_queryKey_location: key } })
    return row ? { payload: row.payload, error: row.error, fetchedAt: row.fetchedAt, refreshAfter: row.refreshAfter } : null
  },
  async put(key, row) {
    const payload = row.payload === null || row.payload === undefined ? Prisma.DbNull : (row.payload as Prisma.InputJsonValue)
    await prisma.adzunaInsightCache.upsert({
      where: { endpoint_queryKey_location: key },
      create: { ...key, payload, error: row.error, fetchedAt: row.fetchedAt, refreshAfter: row.refreshAfter },
      update: { payload, error: row.error, fetchedAt: row.fetchedAt, refreshAfter: row.refreshAfter },
    })
  },
  async markHit(key, now) {
    await prisma.adzunaInsightCache.update({
      where: { endpoint_queryKey_location: key },
      data: { hitCount: { increment: 1 }, lastHitAt: now },
    })
  },
}

export const prismaBudget: BudgetStore = {
  async tryConsume(buckets) {
    for (const { bucket, limit } of buckets) {
      // Conditional upsert: the increment only lands while count < limit,
      // so two concurrent requests can't both take the last slot.
      const rows = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "AdzunaApiUsage" ("bucket", "count", "updatedAt") VALUES (${bucket}, 1, now())
        ON CONFLICT ("bucket") DO UPDATE SET "count" = "AdzunaApiUsage"."count" + 1, "updatedAt" = now()
        WHERE "AdzunaApiUsage"."count" < ${limit}
        RETURNING "count"`
      if (rows.length === 0) return false
    }
    return true
  },
  async record(buckets) {
    for (const bucket of buckets) {
      await prisma.$executeRaw`
        INSERT INTO "AdzunaApiUsage" ("bucket", "count", "updatedAt") VALUES (${bucket}, 1, now())
        ON CONFLICT ("bucket") DO UPDATE SET "count" = "AdzunaApiUsage"."count" + 1, "updatedAt" = now()`
    }
  },
}

// For Adzuna calls made outside this module (job listings and posting
// counts in adzuna.ts), so the statistics budget sees the app's real total.
// Never throws, never blocks those callers.
export function recordAdzunaCall(): void {
  const now = new Date()
  const periods: BudgetPeriod[] = ['month', 'week', 'day', 'minute']
  prismaBudget.record(periods.map((p) => bucketId('all', p, now))).catch(() => {})
}

// ── Live HTTP ────────────────────────────────────────────────────────────────

function credentials(): { appId: string; appKey: string } | null {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  return appId && appKey ? { appId, appKey } : null
}

function stateFromLocationKey(location: string): string | null {
  return location === 'us' ? null : resolveState(location)
}

export function buildAdzunaUrl(key: InsightKey, creds: { appId: string; appKey: string }): string {
  const params = new URLSearchParams({ app_id: creds.appId, app_key: creds.appKey, what: key.queryKey, location0: 'US' })
  const state = stateFromLocationKey(key.location)
  // geodata is always national — the point is the state-by-state spread.
  if (state && key.endpoint !== 'geodata') params.set('location1', state)
  const path: Record<AdzunaInsightEndpoint, string> = {
    histogram: 'histogram',
    history: 'history',
    top_companies: 'top_companies',
    geodata: 'geodata',
    demand: 'search/1',
  }
  if (key.endpoint === 'history') params.set('months', '6')
  if (key.endpoint === 'demand') params.set('results_per_page', '1')
  return `${BASE}/${path[key.endpoint]}?${params.toString()}`
}

async function fetchLive(key: InsightKey): Promise<LiveResult> {
  const creds = credentials()
  if (!creds) return { ok: false, error: 'Adzuna credentials are not configured.' }
  try {
    const res = await fetch(buildAdzunaUrl(key, creds), { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!res.ok) return { ok: false, error: `Adzuna ${key.endpoint} returned ${res.status}` }
    return { ok: true, json: await res.json() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Adzuna request failed' }
  }
}

function schedule(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    // No request scope (script/cron) — the next real request refreshes it.
  }
}

function deps(): InsightDeps {
  return { store: prismaStore, budget: prismaBudget, fetchLive, schedule, configured: credentials() !== null }
}

// ── Public fetchers ──────────────────────────────────────────────────────────

export interface MarketScope {
  role: string | null | undefined
  // US state abbreviation or name; null/unknown -> national
  state?: string | null
}

function keyFor<E extends AdzunaInsightEndpoint>(endpoint: E, scope: MarketScope): (InsightKey & { endpoint: E }) | null {
  const queryKey = normalizeRoleQuery(scope.role)
  if (!queryKey) return null
  const state = endpoint === 'geodata' ? null : resolveState(scope.state)
  return { endpoint, queryKey, location: locationKey(state) }
}

async function read<E extends AdzunaInsightEndpoint>(
  endpoint: E,
  scope: MarketScope,
  options?: GetInsightOptions
): Promise<InsightResult<InsightPayloads[E]>> {
  const key = keyFor(endpoint, scope)
  if (!key) return { data: null, fetchedAt: null, source: 'none' }
  try {
    return await getInsight(key, deps(), options)
  } catch (e) {
    console.error(`Adzuna ${endpoint} insight failed:`, e)
    return { data: null, fetchedAt: null, source: 'none' }
  }
}

export const getSalaryHistogram = (scope: MarketScope, o?: GetInsightOptions) => read('histogram', scope, o)
export const getSalaryHistory = (scope: MarketScope, o?: GetInsightOptions) => read('history', scope, o)
export const getTopHiringCompanies = (scope: MarketScope, o?: GetInsightOptions) => read('top_companies', scope, o)
export const getDemandByState = (scope: MarketScope, o?: GetInsightOptions) => read('geodata', scope, o)
export const getDemandCount = (scope: MarketScope, o?: GetInsightOptions) => read('demand', scope, o)

// The member's role for market statistics: their stated target title, then
// target function, then current function.
export function memberMarketRole(p: {
  targetRoleType?: string | null
  targetFunction?: string | null
  primaryFunction?: string | null
}): string | null {
  return p.targetRoleType?.trim() || p.targetFunction?.trim() || p.primaryFunction?.trim() || null
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function getAdzunaBudgetUsage(now = new Date()) {
  const scopes: BudgetScope[] = ['all', 'insights']
  const periods: BudgetPeriod[] = ['minute', 'day', 'week', 'month']
  const ids = scopes.flatMap((s) => periods.map((p) => bucketId(s, p, now)))
  const rows = await prisma.adzunaApiUsage.findMany({ where: { bucket: { in: ids } } })
  const byId = new Map(rows.map((r) => [r.bucket, r.count]))
  return scopes.map((scope) => ({
    scope,
    periods: periods.map((period) => ({
      period,
      used: byId.get(bucketId(scope, period, now)) ?? 0,
      limit: BUDGET_LIMITS[scope][period],
    })),
  }))
}
