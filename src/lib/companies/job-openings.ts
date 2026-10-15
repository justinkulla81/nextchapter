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
 * Inserts or refreshes openings by URL in one statement. A row already held keeps its
 * earliest first-seen date and latest last-seen date; whichever write saw the job
 * most recently decides whether it is closed. Returns rows written.
 */
export async function upsertOpenings(rows: OpeningRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const byUrl = new Map<string, OpeningRow>()
  for (const r of rows) byUrl.set(r.url, r)
  const payload = JSON.stringify([...byUrl.values()])
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
      "sourceName" = COALESCE(EXCLUDED."sourceName", "CompanyJobOpening"."sourceName"),
      "updatedAt" = now()
    `,
    payload
  )
}

/** Openings whose board listing has been archived are closed on the archive date. */
export async function closeArchivedOpenings(): Promise<number> {
  return prisma.$executeRawUnsafe(`
    UPDATE "CompanyJobOpening" o
    SET "closedAt" = p."archivedAt", "updatedAt" = now()
    FROM "ExclusiveJobPosting" p
    WHERE p.url = o.url AND p."archivedAt" IS NOT NULL AND o."closedAt" IS NULL
      AND o."lastSeenAt" <= p."archivedAt"
  `)
}
