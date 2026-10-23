import 'server-only'
import { prisma } from '@/lib/prisma'
import type { EntryMarket, EntryMarketRow } from './entry-market'

// Entry-level numbers from the live board (entry-filters.ts), for the daily AiMarketSnapshot (cron
// /api/cron/ai-market) and the admin AI market page. Same open-job rule and per-role dedupe as the workforce
// page's counts (src/lib/marketing/workforce-numbers.ts); US only.

const LIVE = `"status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND COALESCE("distribution", '') <> 'EXCLUDED'
  AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND COALESCE("employmentType", '') NOT IN ('internship', 'co_op', 'coop')
  AND COALESCE(upper("locationCountry"), 'US') = 'US'`

type Row = { g: string | null; dim: string; n: number; entry: number; no_exp: number; entry_ai: number; entry_ai_pref: number }

export async function computeEntryMarket(): Promise<EntryMarket> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '120s'`)
    return tx.$queryRawUnsafe<Row[]>(`WITH roles AS (
        SELECT DISTINCT ON (COALESCE("crawlerFingerprint", "id"))
          "level" IN ('ENTRY_IC', 'EARLY_IC') AS entry, "postingSignals" AS s,
          COALESCE("targetFunction", 'Unknown') AS fn, COALESCE("industry", 'unknown') AS ind, COALESCE("employerSector", 'private') AS sec
        FROM "ExclusiveJobPosting" WHERE ${LIVE}
        ORDER BY COALESCE("crawlerFingerprint", "id"), "lastVerifiedAt" DESC NULLS LAST, "createdAt" DESC
      ), t AS (
        SELECT fn, ind, sec, entry,
          entry AND 'no_experience_ok' = ANY(s) AS no_exp,
          entry AND 'entry_ai' = ANY(s) AS entry_ai,
          entry AND 'entry_ai_preferred' = ANY(s) AS entry_ai_pref
        FROM roles
      )
      SELECT CASE WHEN GROUPING(fn) = 0 THEN fn WHEN GROUPING(ind) = 0 THEN ind WHEN GROUPING(sec) = 0 THEN sec END AS g,
        CASE WHEN GROUPING(fn) = 0 THEN 'fn' WHEN GROUPING(ind) = 0 THEN 'ind' WHEN GROUPING(sec) = 0 THEN 'sec' ELSE 'all' END AS dim,
        count(*)::int AS n, count(*) FILTER (WHERE entry)::int AS entry, count(*) FILTER (WHERE no_exp)::int AS no_exp,
        count(*) FILTER (WHERE entry_ai)::int AS entry_ai, count(*) FILTER (WHERE entry_ai_pref)::int AS entry_ai_pref
      FROM t GROUP BY GROUPING SETS ((), (fn), (ind), (sec))`)
  }, { timeout: 150_000 })
  const all = rows.find((r) => r.dim === 'all')
  if (!all) throw new Error('entry market returned no total')
  const top = (dim: string, k: number): EntryMarketRow[] =>
    rows
      .filter((r) => r.dim === dim && r.entry > 0)
      .sort((a, b) => b.entry - a.entry)
      .slice(0, k)
      .map((r) => ({ key: r.g ?? 'unknown', entry: r.entry, noExp: r.no_exp, entryAi: r.entry_ai }))
  return {
    liveUs: all.n,
    entry: all.entry,
    noExp: all.no_exp,
    entryAi: all.entry_ai,
    entryAiPreferred: all.entry_ai_pref,
    byFunction: top('fn', 10),
    byIndustry: top('ind', 10),
    bySector: top('sec', 4),
  }
}
