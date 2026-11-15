import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { screenJobTitle, seniorityGroupOf } from '@/lib/jobs/job-seniority'
import { annualizePay, statesFromLocation } from '@/lib/pay/market-pay'

// The company job-opening history (CompanyJobOpening): one row per listing URL we
// have ever seen, kept after the board listing is archived. Every writer goes
// through upsertOpenings so a re-sent job only moves its first/last-seen window.

export type OpeningSource = 'import' | 'crawler_history' | 'board'

export interface OpeningInput {
  url: string
  title: string
  companyName: string
  location?: string | null
  level?: string | null
  industry?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  postedAt?: Date | null
  sourceName?: string | null
  // Every US state the import resolved for the posting (multi-location jobs, or a
  // location text that names none); used when the location text yields no state.
  locationStates?: string[] | null
}

export interface OpeningRow {
  companyId: string
  url: string
  title: string
  companyName: string
  location: string | null
  states: string[]
  isRemote: boolean
  level: string | null
  seniorityGroup: string | null
  function: string | null
  industry: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  payAnnualMin: number | null
  payAnnualMax: number | null
  payAnnualMid: number | null
  postedAt: string | null
  firstSeenAt: string
  lastSeenAt: string
  closedAt: string | null
  sourceName: string | null
  source: OpeningSource
}

// A btree index entry has a size limit; no real listing URL comes close.
const MAX_URL_LENGTH = 2000

export function buildOpeningRow(
  input: OpeningInput,
  companyId: string,
  source: OpeningSource,
  seen: { firstSeenAt: Date; lastSeenAt: Date; closedAt: Date | null }
): OpeningRow | null {
  const url = input.url.trim()
  const title = input.title.trim()
  if (!url || url.length > MAX_URL_LENGTH || !title) return null
  const level = input.level?.trim() || (() => {
    const v = screenJobTitle(title)
    return v.keep ? v.level : null
  })()
  const parsed = statesFromLocation(input.location)
  const isRemote = parsed.isRemote
  const states = parsed.states.length ? parsed.states : (input.locationStates ?? []).filter((s) => /^[A-Z]{2}$/.test(s))
  const pay = annualizePay(input.salaryMin, input.salaryMax, input.salaryCurrency)
  const posted = input.postedAt && !Number.isNaN(input.postedAt.getTime()) ? input.postedAt : null
  return {
    companyId,
    url,
    title: title.slice(0, 500),
    companyName: input.companyName.trim().slice(0, 300),
    location: input.location?.trim().slice(0, 500) || null,
    states,
    isRemote,
    level,
    seniorityGroup: seniorityGroupOf(level),
    function: inferFunctionFromTitle(title),
    industry: input.industry?.trim() || null,
    salaryMin: typeof input.salaryMin === 'number' ? input.salaryMin : null,
    salaryMax: typeof input.salaryMax === 'number' ? input.salaryMax : null,
    salaryCurrency: input.salaryCurrency?.trim() || null,
    payAnnualMin: pay?.min ?? null,
    payAnnualMax: pay?.max ?? null,
    payAnnualMid: pay?.mid ?? null,
    postedAt: posted ? posted.toISOString() : null,
    firstSeenAt: seen.firstSeenAt.toISOString(),
    lastSeenAt: seen.lastSeenAt.toISOString(),
    closedAt: seen.closedAt ? seen.closedAt.toISOString() : null,
    sourceName: input.sourceName?.trim() || null,
    source,
  }
}

/**
 * Inserts or refreshes openings by URL, in statements of at most 200 rows. A row already held keeps its
 * earliest first-seen date and latest last-seen date; whichever write saw the job
 * most recently decides whether it is closed. Returns rows written.
 */
export async function upsertOpenings(rows: OpeningRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const byUrl = new Map<string, OpeningRow>()
  for (const r of rows) byUrl.set(r.url, r)
  // Bounded statements: one giant upsert can run for many seconds under load,
  // hold row locks the whole time and queue every other page behind it.
  const unique = [...byUrl.values()]
  let written = 0
  for (let i = 0; i < unique.length; i += UPSERT_CHUNK) {
    written += await upsertOpeningChunk(unique.slice(i, i + UPSERT_CHUNK))
  }
  return written
}

const UPSERT_CHUNK = 200

async function upsertOpeningChunk(rows: OpeningRow[]): Promise<number> {
  const payload = JSON.stringify(rows)
  return prisma.$executeRawUnsafe(
    `
    INSERT INTO "CompanyJobOpening" (
      "id", "companyId", "url", "title", "companyName", "location", "states", "isRemote", "level", "seniorityGroup",
      "function", "industry", "salaryMin", "salaryMax", "salaryCurrency", "payAnnualMin", "payAnnualMax", "payAnnualMid",
      "postedAt", "firstSeenAt", "lastSeenAt", "closedAt", "sourceName", "source", "updatedAt"
    )
    SELECT
      'cjo' || substr(md5(r.url), 1, 22), r."companyId", r.url, r.title, r."companyName", r.location,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(r.states)), ARRAY[]::text[]), r."isRemote", r.level, r."seniorityGroup",
      r.function, r.industry, r."salaryMin", r."salaryMax", r."salaryCurrency", r."payAnnualMin", r."payAnnualMax", r."payAnnualMid",
      r."postedAt", r."firstSeenAt", r."lastSeenAt", r."closedAt", r."sourceName", r.source, now()
    FROM jsonb_to_recordset($1::jsonb) AS r(
      "companyId" text, url text, title text, "companyName" text, location text, states jsonb, "isRemote" boolean,
      level text, "seniorityGroup" text, function text, industry text, "salaryMin" float8, "salaryMax" float8,
      "salaryCurrency" text, "payAnnualMin" int, "payAnnualMax" int, "payAnnualMid" int, "postedAt" timestamp,
      "firstSeenAt" timestamp, "lastSeenAt" timestamp, "closedAt" timestamp, "sourceName" text, source text
    )
    ON CONFLICT ("url") DO UPDATE SET
      "companyId" = EXCLUDED."companyId",
      "title" = EXCLUDED."title",
      "companyName" = EXCLUDED."companyName",
      "location" = COALESCE(EXCLUDED."location", "CompanyJobOpening"."location"),
      "states" = CASE WHEN EXCLUDED."location" IS NULL THEN "CompanyJobOpening"."states" ELSE EXCLUDED."states" END,
      "isRemote" = CASE WHEN EXCLUDED."location" IS NULL THEN "CompanyJobOpening"."isRemote" ELSE EXCLUDED."isRemote" END,
      "level" = COALESCE(EXCLUDED."level", "CompanyJobOpening"."level"),
      "seniorityGroup" = COALESCE(EXCLUDED."seniorityGroup", "CompanyJobOpening"."seniorityGroup"),
      "function" = COALESCE(EXCLUDED."function", "CompanyJobOpening"."function"),
      "industry" = COALESCE(EXCLUDED."industry", "CompanyJobOpening"."industry"),
      "salaryMin" = COALESCE(EXCLUDED."salaryMin", "CompanyJobOpening"."salaryMin"),
      "salaryMax" = COALESCE(EXCLUDED."salaryMax", "CompanyJobOpening"."salaryMax"),
      "salaryCurrency" = COALESCE(EXCLUDED."salaryCurrency", "CompanyJobOpening"."salaryCurrency"),
      "payAnnualMin" = COALESCE(EXCLUDED."payAnnualMin", "CompanyJobOpening"."payAnnualMin"),
      "payAnnualMax" = COALESCE(EXCLUDED."payAnnualMax", "CompanyJobOpening"."payAnnualMax"),
      "payAnnualMid" = COALESCE(EXCLUDED."payAnnualMid", "CompanyJobOpening"."payAnnualMid"),
      "postedAt" = COALESCE(EXCLUDED."postedAt", "CompanyJobOpening"."postedAt"),
      "firstSeenAt" = LEAST(EXCLUDED."firstSeenAt", "CompanyJobOpening"."firstSeenAt"),
      "lastSeenAt" = GREATEST(EXCLUDED."lastSeenAt", "CompanyJobOpening"."lastSeenAt"),
      "closedAt" = CASE WHEN EXCLUDED."lastSeenAt" >= "CompanyJobOpening"."lastSeenAt" THEN EXCLUDED."closedAt" ELSE "CompanyJobOpening"."closedAt" END,
      -- A listing seen open again (reopened) drops its old close reason.
      "closeReason" = CASE WHEN EXCLUDED."lastSeenAt" >= "CompanyJobOpening"."lastSeenAt" AND EXCLUDED."closedAt" IS NULL THEN NULL ELSE "CompanyJobOpening"."closeReason" END,
      "sourceName" = COALESCE(EXCLUDED."sourceName", "CompanyJobOpening"."sourceName"),
      "updatedAt" = now()
    `,
    payload
  )
}

/** Openings whose board listing has been archived are closed on the archive date, with its reason (job-status.ts). */
export async function closeArchivedOpenings(opts: { deadline?: number; since?: Date | null } = {}): Promise<number> {
  // BATCH rows per statement: a backlog of archived listings (a mass archive) closed in
  // one UPDATE outruns the 2-minute statement timeout. Rerun-safe; leftovers wait.
  //
  // Each batch continues after the last url of the one before (keyset), so it never walks past the openings it already closed:
  // the old form restarted at the top of the url index every batch and got slower with each one, until a single statement ran
  // past the timeout (2026-11-09: "close failed after 120s"). With `since` (the nightly run) only postings archived since a day
  // before it are looked at, through the archivedAt index; without it (a first run, with no good run before it) every archived posting is.
  // `p.url > $1` is spelled out: Postgres does not carry o.url > $1 across the join, so without it every batch walked the posting url index
  // from the top again. sweepOpenOpenings is the bounded catch-all for what this misses.
  const BATCH = 5000
  const since = opts.since ? new Date(opts.since.getTime() - 86_400_000) : null
  let total = 0
  let last = ''
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<{ n: number; last: string | null }[]>(
      `
      WITH batch AS (
        SELECT o.id, o.url, p."archivedAt" AS at, p."closeReason" AS reason
        FROM "ExclusiveJobPosting" p
        JOIN "CompanyJobOpening" o ON o.url = p.url
        WHERE p."archivedAt" IS NOT NULL AND o."closedAt" IS NULL AND o."lastSeenAt" <= p."archivedAt"
          AND o.url > $1 AND p.url > $1 ${since ? 'AND p."archivedAt" >= $2' : ''}
        ORDER BY o.url
        LIMIT ${BATCH}
      ), u AS (
        UPDATE "CompanyJobOpening" o
        SET "closedAt" = b.at, "closeReason" = b.reason, "updatedAt" = now()
        FROM batch b WHERE o.id = b.id
        RETURNING b.url
      )
      SELECT count(*)::int AS n, max(url) AS last FROM u
      `,
      ...(since ? [last, since] : [last])
    )
    const n = rows[0]?.n ?? 0
    total += n
    if (n < BATCH || !rows[0]?.last || (opts.deadline && Date.now() > opts.deadline)) return total
    last = rows[0].last
  }
}

/** Open openings looked at per sweep statement: about 8-15 s on a cold cache (measured 2026-11-15), far inside the 2-minute statement timeout. */
export const SWEEP_WINDOW = 10_000

/**
 * The catch-all for openings the nightly pass missed (a run that failed, a posting archived before its opening was copied): walks the open
 * openings in url order, a fixed window of SWEEP_WINDOW per statement, and closes those whose posting is archived. It replaces the Sunday
 * sweep of every archived posting, which joined two 1.5M-row url indexes and ran past the 2-minute statement timeout every Sunday
 * (2026-11-08, 11-09, 11-15): its last batch, finding few matches, walked both indexes to the end.
 *
 * Each statement costs the same however many openings it closes. The run stops at its deadline and returns where it stopped (`after`), so
 * the next night carries on from there; null once it reaches the last opening, so the next night starts over from the top.
 */
export async function sweepOpenOpenings(opts: { after: string | null; deadline: number }): Promise<{ closed: number; windows: number; after: string | null }> {
  let after = opts.after ?? ''
  let closed = 0
  let windows = 0
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<{ seen: number; n: number; last: string | null }[]>(
      `
      WITH win AS (
        SELECT o.id, o.url, o."lastSeenAt"
        FROM "CompanyJobOpening" o
        WHERE o."closedAt" IS NULL AND o.url > $1
        ORDER BY o.url
        LIMIT ${SWEEP_WINDOW}
      ), batch AS (
        SELECT w.id, p."archivedAt" AS at, p."closeReason" AS reason
        FROM win w JOIN "ExclusiveJobPosting" p ON p.url = w.url
        WHERE p."archivedAt" IS NOT NULL AND w."lastSeenAt" <= p."archivedAt"
      ), u AS (
        UPDATE "CompanyJobOpening" o
        SET "closedAt" = b.at, "closeReason" = b.reason, "updatedAt" = now()
        FROM batch b WHERE o.id = b.id
        RETURNING o.id
      )
      SELECT (SELECT count(*)::int FROM win) AS seen, (SELECT count(*)::int FROM u) AS n, (SELECT max(url) FROM win) AS last
      `,
      after
    )
    windows++
    const { seen = 0, n = 0, last = null } = rows[0] ?? {}
    closed += n
    if (seen < SWEEP_WINDOW || !last) return { closed, windows, after: null }
    after = last
    if (Date.now() > opts.deadline) return { closed, windows, after }
  }
}
