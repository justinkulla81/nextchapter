// Pure half of the Adzuna labor-market statistics integration: response
// parsing, query/location normalization, budget buckets, and the
// cache-or-fetch decision. No Prisma, no fetch, no Next.js — everything with
// a side effect is injected, so src/test/adzuna-insights.test.ts can drive it
// with fixture JSON and in-memory stores. The server wiring (Prisma store,
// real HTTP calls) lives in adzuna-insights.ts.
import { STATE_NAMES } from '@/lib/workforce/places'

// ── Types ────────────────────────────────────────────────────────────────────

export type AdzunaInsightEndpoint = 'histogram' | 'history' | 'top_companies' | 'geodata' | 'demand'

export interface SalaryHistogram {
  // Ascending by lower bound. Adzuna buckets are $20k wide; the last one is
  // open-ended ("$140k+").
  buckets: { min: number; count: number }[]
  total: number
}

export interface SalaryHistory {
  // Ascending by month ("2026-04").
  points: { month: string; averageSalary: number }[]
}

export interface TopCompanies {
  // Adzuna returns at most 5, busiest first.
  companies: { name: string; count: number }[]
}

export interface DemandByState {
  // Busiest first.
  states: { state: string; count: number }[]
}

export interface DemandCount {
  count: number
  meanSalary: number | null
}

export interface InsightPayloads {
  histogram: SalaryHistogram
  history: SalaryHistory
  top_companies: TopCompanies
  geodata: DemandByState
  demand: DemandCount
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// Each parser returns null when the response has nothing usable — the caller
// caches that as "no data" rather than as a broken row.
export function parseHistogram(json: unknown): SalaryHistogram | null {
  if (!isRecord(json) || !isRecord(json.histogram)) return null
  const buckets = Object.entries(json.histogram)
    .map(([k, v]) => ({ min: Number(k), count: num(v) ?? 0 }))
    .filter((b) => Number.isFinite(b.min) && b.min >= 0 && b.count >= 0)
    .sort((a, b) => a.min - b.min)
  // Leading empty buckets ($20k–$60k with 0 postings for a VP role) are
  // noise in the chart and don't change any percentile.
  while (buckets.length > 1 && buckets[0].count === 0) buckets.shift()
  const total = buckets.reduce((n, b) => n + b.count, 0)
  return total > 0 ? { buckets, total } : null
}

export function parseHistory(json: unknown): SalaryHistory | null {
  if (!isRecord(json) || !isRecord(json.month)) return null
  const points = Object.entries(json.month)
    .map(([month, v]) => ({ month, averageSalary: num(v) ?? 0 }))
    .filter((p) => /^\d{4}-\d{2}$/.test(p.month) && p.averageSalary > 0)
    .map((p) => ({ ...p, averageSalary: Math.round(p.averageSalary) }))
    .sort((a, b) => a.month.localeCompare(b.month))
  return points.length > 0 ? { points } : null
}

export function parseTopCompanies(json: unknown): TopCompanies | null {
  if (!isRecord(json) || !Array.isArray(json.leaderboard)) return null
  const companies = json.leaderboard
    .filter(isRecord)
    .map((c) => ({ name: typeof c.canonical_name === 'string' ? c.canonical_name.trim() : '', count: num(c.count) ?? 0 }))
    .filter((c) => c.name && c.count > 0)
    .sort((a, b) => b.count - a.count)
  return companies.length > 0 ? { companies } : null
}

export function parseGeodata(json: unknown): DemandByState | null {
  if (!isRecord(json) || !Array.isArray(json.locations)) return null
  const states = json.locations
    .filter(isRecord)
    .map((l) => {
      const loc = isRecord(l.location) ? l.location : {}
      const area = Array.isArray(loc.area) ? loc.area : []
      const state = typeof area[1] === 'string' ? area[1] : typeof loc.display_name === 'string' ? loc.display_name.replace(/, US$/, '') : ''
      return { state, count: num(l.count) ?? 0 }
    })
    .filter((s) => s.state && s.count > 0)
    .sort((a, b) => b.count - a.count)
  return states.length > 0 ? { states } : null
}

export function parseDemandCount(json: unknown): DemandCount | null {
  if (!isRecord(json)) return null
  const count = num(json.count)
  if (count === null) return null
  const mean = num(json.mean)
  return { count, meanSalary: mean !== null && mean > 0 ? Math.round(mean) : null }
}

export const PARSERS: { [E in AdzunaInsightEndpoint]: (json: unknown) => InsightPayloads[E] | null } = {
  histogram: parseHistogram,
  history: parseHistory,
  top_companies: parseTopCompanies,
  geodata: parseGeodata,
  demand: parseDemandCount,
}

// ── Derived numbers ──────────────────────────────────────────────────────────

const BUCKET_WIDTH = 20000

// Approximate percentile from bucketed counts, interpolating linearly inside
// a bucket. The open-ended top bucket can't be interpolated, so anything
// landing there reports the bucket's lower bound — an honest floor, never an
// invented ceiling.
export function histogramPercentile(h: SalaryHistogram, p: number): number | null {
  if (h.total <= 0 || h.buckets.length === 0) return null
  const target = Math.min(Math.max(p, 0), 1) * h.total
  let seen = 0
  for (let i = 0; i < h.buckets.length; i++) {
    const b = h.buckets[i]
    if (seen + b.count >= target && b.count > 0) {
      if (i === h.buckets.length - 1) return b.min
      const width = (h.buckets[i + 1]?.min ?? b.min + BUCKET_WIDTH) - b.min
      return Math.round(b.min + ((target - seen) / b.count) * width)
    }
    seen += b.count
  }
  return h.buckets[h.buckets.length - 1].min
}

// Share of advertised salaries below `salary` (0–1), same interpolation.
export function histogramShareBelow(h: SalaryHistogram, salary: number): number | null {
  if (h.total <= 0) return null
  let below = 0
  for (let i = 0; i < h.buckets.length; i++) {
    const b = h.buckets[i]
    const next = h.buckets[i + 1]?.min
    if (next === undefined) {
      if (salary > b.min) below += b.count / 2
      break
    }
    if (salary >= next) below += b.count
    else if (salary > b.min) below += (b.count * (salary - b.min)) / (next - b.min)
  }
  return Math.min(1, below / h.total)
}

export function historyChangePct(h: SalaryHistory): number | null {
  if (h.points.length < 2) return null
  const first = h.points[0].averageSalary
  const last = h.points[h.points.length - 1].averageSalary
  return first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : null
}

// ── Normalization ────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'at'])

// "VP of Marketing & Growth" -> "vp marketing growth". Same role typed two
// ways must share one cache row, and Adzuna's `what` ANDs every word, so
// filler words only narrow the match.
export function normalizeRoleQuery(role: string | null | undefined): string | null {
  if (!role) return null
  const words = role
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
  const q = words.join(' ').slice(0, 60).trim()
  return q || null
}

const STATE_BY_NAME = new Map(Object.values(STATE_NAMES).map((n) => [n.toLowerCase(), n]))

// "MA" | "Massachusetts" | " massachusetts " -> "Massachusetts"; anything
// else -> null (national scope). State is the finest level Adzuna names
// reliably for US statistics — metro names don't map cleanly.
export function resolveState(state: string | null | undefined): string | null {
  if (!state) return null
  const t = state.trim()
  if (!t) return null
  return STATE_NAMES[t.toUpperCase()] ?? STATE_BY_NAME.get(t.toLowerCase()) ?? null
}

export function locationKey(state: string | null): string {
  return state ? state.toLowerCase() : 'us'
}

// ── Budget ───────────────────────────────────────────────────────────────────

// Adzuna's published default limits: 25/minute, 250/day, 1,000/week,
// 2,500/month, shared by everything on our key. "all" counts every Adzuna
// call this app makes (job listings and posting counts in adzuna.ts too),
// with headroom for the external ncrawl job crawler (~72 calls/week, not
// counted here). "insights" is this module's own sub-budget, kept small so
// statistics can never starve job search. Both must have room before a
// statistics call goes out; otherwise stale cache or nothing is served.
export const BUDGET_LIMITS = {
  all: { minute: 20, day: 200, week: 850, month: 2200 },
  insights: { minute: 10, day: 100, week: 250, month: 600 },
} as const

export type BudgetScope = keyof typeof BUDGET_LIMITS
export type BudgetPeriod = keyof (typeof BUDGET_LIMITS)['all']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// UTC bucket labels. Week buckets are keyed by their Monday.
export function periodKey(period: BudgetPeriod, now: Date): string {
  const y = now.getUTCFullYear()
  const m = pad(now.getUTCMonth() + 1)
  const d = pad(now.getUTCDate())
  switch (period) {
    case 'minute':
      return `${y}-${m}-${d}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`
    case 'day':
      return `${y}-${m}-${d}`
    case 'week': {
      const monday = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)))
      return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`
    }
    case 'month':
      return `${y}-${m}`
  }
}

export function bucketId(scope: BudgetScope, period: BudgetPeriod, now: Date): string {
  return `${scope}:${period}:${periodKey(period, now)}`
}

const PERIODS: BudgetPeriod[] = ['month', 'week', 'day', 'minute']

// Longest period first: if the month is spent, nothing smaller gets bumped.
export function budgetBucketsFor(scopes: BudgetScope[], now: Date): { bucket: string; limit: number }[] {
  return scopes.flatMap((scope) => PERIODS.map((period) => ({ bucket: bucketId(scope, period, now), limit: BUDGET_LIMITS[scope][period] })))
}

export interface BudgetStore {
  // Atomically increments each bucket only while it's under its limit, in
  // order, stopping at the first full one. Returns whether every bucket
  // accepted the increment. A refusal part-way leaves earlier buckets
  // bumped — a conservative over-count, never an under-count.
  tryConsume(buckets: { bucket: string; limit: number }[]): Promise<boolean>
  // Unconditional increment, for calls made outside this module.
  record(buckets: string[]): Promise<void>
}

// ── Cache ────────────────────────────────────────────────────────────────────

export const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // at most weekly
export const EMPTY_RETRY_MS = 3 * 24 * 60 * 60 * 1000 // "no data" answers
export const ERROR_RETRY_MS = 24 * 60 * 60 * 1000 // failed fetches

export interface InsightKey {
  endpoint: AdzunaInsightEndpoint
  queryKey: string
  location: string
}

export interface CacheRow {
  payload: unknown
  error: string | null
  fetchedAt: Date
  refreshAfter: Date
}

export interface InsightStore {
  get(key: InsightKey): Promise<CacheRow | null>
  put(key: InsightKey, row: CacheRow): Promise<void>
  markHit(key: InsightKey, now: Date): Promise<void>
}

export type LiveResult = { ok: true; json: unknown } | { ok: false; error: string }

export interface InsightResult<T> {
  data: T | null
  fetchedAt: Date | null
  // where `data` came from on this call
  source: 'cache' | 'stale_cache' | 'live' | 'none'
  // why no live call happened when one was due, if any
  skipped?: 'over_budget' | 'deferred' | 'not_configured'
}

export interface InsightDeps {
  store: InsightStore
  budget: BudgetStore
  fetchLive: (key: InsightKey) => Promise<LiveResult>
  // Runs work after the response (Next's after()); absent in tests/scripts.
  schedule?: (task: () => Promise<void>) => void
  now?: () => Date
  configured?: boolean
}

export interface GetInsightOptions {
  // What to do on a cold miss: "fetch" calls Adzuna inline (use inside a
  // Suspense boundary); "background" returns nothing now and fills the
  // cache after the response, for pages that must not wait.
  onMiss?: 'fetch' | 'background'
}

const inflight = new Map<string, Promise<InsightResult<unknown>>>()

function keyString(k: InsightKey): string {
  return `${k.endpoint}|${k.queryKey}|${k.location}`
}

async function refresh<E extends AdzunaInsightEndpoint>(
  key: InsightKey & { endpoint: E },
  prior: CacheRow | null,
  deps: InsightDeps,
  now: Date
): Promise<InsightResult<InsightPayloads[E]>> {
  const priorData = (prior?.payload ?? null) as InsightPayloads[E] | null
  const fallback = (skipped?: InsightResult<unknown>['skipped']): InsightResult<InsightPayloads[E]> => ({
    data: priorData,
    fetchedAt: priorData ? prior!.fetchedAt : null,
    source: priorData ? 'stale_cache' : 'none',
    ...(skipped ? { skipped } : {}),
  })

  if (deps.configured === false) return fallback('not_configured')
  if (!(await deps.budget.tryConsume(budgetBucketsFor(['all', 'insights'], now)))) return fallback('over_budget')

  const live = await deps.fetchLive(key).catch((e): LiveResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  if (!live.ok) {
    // Keep the older good payload; just don't retry for a day.
    await deps.store.put(key, {
      payload: priorData,
      error: live.error.slice(0, 500),
      fetchedAt: prior?.fetchedAt ?? now,
      refreshAfter: new Date(now.getTime() + ERROR_RETRY_MS),
    })
    return fallback()
  }

  const parsed = PARSERS[key.endpoint](live.json) as InsightPayloads[E] | null
  if (parsed === null && priorData) {
    // Adzuna answered but with nothing usable; a week-old real answer beats
    // an empty one, so keep it and look again sooner.
    await deps.store.put(key, { payload: priorData, error: 'empty response', fetchedAt: prior!.fetchedAt, refreshAfter: new Date(now.getTime() + EMPTY_RETRY_MS) })
    return fallback()
  }
  await deps.store.put(key, {
    payload: parsed,
    error: null,
    fetchedAt: now,
    refreshAfter: new Date(now.getTime() + (parsed ? REFRESH_INTERVAL_MS : EMPTY_RETRY_MS)),
  })
  return { data: parsed, fetchedAt: parsed ? now : null, source: parsed ? 'live' : 'none' }
}

// The one read path. Fresh row -> served from cache. Stale row -> served
// as-is, refreshed after the response. Miss -> fetched inline or in the
// background per `onMiss`. A live call only ever happens through the budget
// guard; over budget means stale cache or nothing, never a live call.
export async function getInsight<E extends AdzunaInsightEndpoint>(
  key: InsightKey & { endpoint: E },
  deps: InsightDeps,
  options: GetInsightOptions = {}
): Promise<InsightResult<InsightPayloads[E]>> {
  const now = (deps.now ?? (() => new Date()))()
  const row = await deps.store.get(key)
  if (row) await deps.store.markHit(key, now).catch(() => {})

  const isFresh = row !== null && row.refreshAfter.getTime() > now.getTime()
  if (row && isFresh) {
    const data = (row.payload ?? null) as InsightPayloads[E] | null
    return { data, fetchedAt: data ? row.fetchedAt : null, source: data ? 'cache' : 'none' }
  }

  const id = keyString(key)
  const run = () => {
    const existing = inflight.get(id)
    if (existing) return existing as Promise<InsightResult<InsightPayloads[E]>>
    const p = refresh(key, row, deps, now).finally(() => inflight.delete(id))
    inflight.set(id, p as Promise<InsightResult<unknown>>)
    return p
  }

  const deferred = row !== null || options.onMiss === 'background'
  if (deferred && deps.schedule) {
    deps.schedule(async () => {
      await run().catch(() => {})
    })
    const data = (row?.payload ?? null) as InsightPayloads[E] | null
    return { data, fetchedAt: data ? row!.fetchedAt : null, source: data ? 'stale_cache' : 'none', skipped: 'deferred' }
  }
  if (deferred && options.onMiss === 'background' && !row) {
    return { data: null, fetchedAt: null, source: 'none', skipped: 'deferred' }
  }
  return run()
}
