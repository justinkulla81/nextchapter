import 'server-only'
import { prisma } from '@/lib/prisma'

export interface TrackerRow {
  key: string
  employer: string
  state: string
  county: string | null
  workers: number | null
  sites: number
  noticeDate: string
  effectiveDate: string | null
  type: string | null
  sourceUrl: string | null
  /** Where the row came from: a state's filing, or a layoff reported elsewhere. */
  origin: 'state' | 'reported'
  sourceLabel: string
  /** A state filing that the press or layoffs.fyi also reported — two sources agree. */
  alsoReported: boolean
}

export interface LayoffTrackerData {
  rows: TrackerRow[]
  /** This calendar year so far. */
  year: { year: number; layoffs: number; workers: number; states: number }
  last30: { notices: number; workers: number; states: number }
  total: { notices: number; states: number; since: string }
  /** States whose own filings we read, out of the 50 plus DC. */
  statesCovered: number
  updatedLabel: string
}

const TZ = 'UTC'
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })

/**
 * An employer name as a reader would write it.
 *
 * Some states publish the site address in the same cell as the name
 * ("Saddle Creek Corporation 771 S. County Line Road PLANT CITY, FL,
 * 33566"). When the matched company's name is the front of that string, it
 * is the name; otherwise the string is cut where a street number starts.
 */
export function cleanEmployer(employer: string, companyName: string | null): string {
  const raw = employer.replace(/\s+/g, ' ').trim()
  if (companyName && companyName.length >= 3 && companyName.length < raw.length
    && raw.toLowerCase().startsWith(companyName.toLowerCase())) {
    return companyName.trim()
  }
  const cut = raw.search(/\s\d{2,}\s+[A-Za-z]/)
  const name = (cut > 3 ? raw.slice(0, cut) : raw)
    // "… MERRITT ISLAND, FL, 32899": the city, state and zip a state appends.
    .replace(/\s+[A-Z][A-Z .'-]+,\s*[A-Z]{2},?\s*\d{5}(?:-\d{4})?$/, '')
    .replace(/[\s,]+$/, '')
  return name.length > 80 ? `${name.slice(0, 79).trimEnd()}…` : name
}

/** A filing type worth printing: words, not a state's internal code. */
export function readableType(type: string | null): string | null {
  const t = type?.replace(/\s+/g, ' ').trim()
  return t && t.length > 3 && /[a-z]/.test(t) ? t : null
}

/** "layoffs.fyi" for the tracker, the site's name for a press report. */
function reportedLabel(url: string | null): string {
  if (!url) return 'Reported'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === 'layoffs.fyi' ? 'layoffs.fyi' : host
  } catch {
    return 'Reported'
  }
}

/**
 * The public layoff tracker's data: WARN notices as filed with state labor
 * departments, plus layoffs reported elsewhere that no filing covers.
 *
 * State filings are the spine. Reported layoffs — the layoffs.fyi tracker
 * and announcements entered by hand from the press — are added only when
 * the same employer has no state filing within 45 days either side, so a
 * layoff is never listed twice, and each such row is labelled with where it
 * came from rather than passed off as a filing. They matter because most of
 * the largest states publish no notice list a program can read.
 *
 * One line per employer per state per date: some states file a row per
 * site, and eight rows of one or two workers each say less than one row
 * saying 46 across eight sites. Dismissed rows are left out.
 *
 * Returns null rather than throwing, so the News page loses the tracker
 * instead of failing with it.
 */
export async function getLayoffTracker(limit = 40): Promise<LayoffTrackerData | null> {
  try {
    const rows = await prisma.$queryRaw<{
      state: string | null; employer: string; company: string | null; county: string | null
      workers: number | null; sites: number; notice_date: Date; effective_date: Date | null
      type: string | null; source_url: string | null; key: string; reported: boolean; also_reported: boolean
    }[]>`
      WITH base AS (
        SELECT w.*,
               (w.source = 'MANUAL_ANNOUNCEMENT' OR w."sourceUrl" ILIKE '%layoffs.fyi%') AS reported,
               -- The employer as a grouping key: lower case, without a site
               -- address in brackets ("Kaiser (1840 California Ave.)"), after
               -- a dash ("Key Energy Services - Ventura Location") or written
               -- straight after the name, as Florida does ("Grunt Style, LLC
               -- 2300 Grand Cypress Dr …"),
               -- punctuation, or a trailing "LLC"/"Inc." — so one employer's
               -- sites, and its name spelled two ways, land on one line.
               -- POSIX classes rather than backslashes: inside this template
               -- a backslash is dropped before the query is sent, which once
               -- made the pattern match nothing and listed 28 sites of one
               -- employer as 28 lines.
               regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(w.employer),
                 '[[:space:]][0-9]{2,}[[:space:]].*$', ''),
                 '[[:space:]]*[(][^)]*[)][[:space:]]*$', ''),
                 '[[:space:]]+-[[:space:]]+.*$', ''),
                 '[^a-z0-9 ]', '', 'g'),
                 '[[:space:]]+(llc|inc|incorporated|corp|corporation|co|company|ltd|lp|llp)$', '') AS gkey
        FROM "WarnNotice" w
        WHERE w."dismissedAt" IS NULL AND w."noticeDate" IS NOT NULL AND w."noticeDate" <= NOW()
      ),
      kept AS (
        SELECT b.*,
               -- A filing the press or layoffs.fyi also reported: two sources agree.
               (NOT b.reported AND (EXISTS (
                 SELECT 1 FROM base r
                 WHERE r.reported AND r."normalizedEmployer" = b."normalizedEmployer"
                   AND r."noticeDate" BETWEEN b."noticeDate" - INTERVAL '45 days' AND b."noticeDate" + INTERVAL '45 days'
               ) OR EXISTS (
                 SELECT 1 FROM "LayoffNewsMention" m
                 WHERE m."companyKey" = b."normalizedEmployer"
                   AND m."publishedAt" BETWEEN b."noticeDate" - INTERVAL '45 days' AND b."noticeDate" + INTERVAL '45 days'
               ))) AS also_reported
        FROM base b
        WHERE NOT b.reported
           OR NOT EXISTS (
             SELECT 1 FROM base f
             WHERE NOT f.reported AND f."normalizedEmployer" = b."normalizedEmployer"
               AND f."noticeDate" BETWEEN b."noticeDate" - INTERVAL '45 days' AND b."noticeDate" + INTERVAL '45 days'
           )
      )
      SELECT k.state,
             MIN(k.employer) AS employer,
             MIN(c.name) FILTER (WHERE k."companyMatchStatus" = 'MATCHED') AS company,
             CASE WHEN COUNT(DISTINCT k.county) = 1 THEN MIN(k.county) END AS county,
             SUM(k.employees)::int AS workers,
             COUNT(*)::int AS sites,
             MIN(k."noticeDate") AS notice_date,
             MIN(k."effectiveDate") AS effective_date,
             CASE WHEN COUNT(DISTINCT k."layoffType") = 1 THEN MIN(k."layoffType") END AS type,
             MIN(k."sourceUrl") AS source_url,
             MIN(k.id) AS key,
             k.reported,
             BOOL_OR(k.also_reported) AS also_reported
      FROM kept k
      LEFT JOIN "Company" c ON c.id = k."companyId"
      GROUP BY k.state, k.gkey, k."noticeDate"::date, k.reported
      ORDER BY MIN(k."noticeDate") DESC, SUM(k.employees) DESC NULLS LAST
      LIMIT ${limit}`

    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
    const [stats] = await prisma.$queryRaw<{
      n30: number; w30: number | null; s30: number; ny: number; wy: number | null; sy: number
      n: number; s: number; since: Date | null; fetched: Date | null; covered: number
    }[]>`
      WITH base AS (
        SELECT w.*,
               (w.source = 'MANUAL_ANNOUNCEMENT' OR w."sourceUrl" ILIKE '%layoffs.fyi%') AS reported,
               -- The employer as a grouping key: lower case, without a site
               -- address in brackets ("Kaiser (1840 California Ave.)"), after
               -- a dash ("Key Energy Services - Ventura Location") or written
               -- straight after the name, as Florida does ("Grunt Style, LLC
               -- 2300 Grand Cypress Dr …"),
               -- punctuation, or a trailing "LLC"/"Inc." — so one employer's
               -- sites, and its name spelled two ways, land on one line.
               -- POSIX classes rather than backslashes: inside this template
               -- a backslash is dropped before the query is sent, which once
               -- made the pattern match nothing and listed 28 sites of one
               -- employer as 28 lines.
               regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(w.employer),
                 '[[:space:]][0-9]{2,}[[:space:]].*$', ''),
                 '[[:space:]]*[(][^)]*[)][[:space:]]*$', ''),
                 '[[:space:]]+-[[:space:]]+.*$', ''),
                 '[^a-z0-9 ]', '', 'g'),
                 '[[:space:]]+(llc|inc|incorporated|corp|corporation|co|company|ltd|lp|llp)$', '') AS gkey
        FROM "WarnNotice" w
        WHERE w."dismissedAt" IS NULL AND w."noticeDate" IS NOT NULL AND w."noticeDate" <= NOW()
      ),
      kept AS (
        SELECT b.*,
               -- A filing the press or layoffs.fyi also reported: two sources agree.
               (NOT b.reported AND (EXISTS (
                 SELECT 1 FROM base r
                 WHERE r.reported AND r."normalizedEmployer" = b."normalizedEmployer"
                   AND r."noticeDate" BETWEEN b."noticeDate" - INTERVAL '45 days' AND b."noticeDate" + INTERVAL '45 days'
               ) OR EXISTS (
                 SELECT 1 FROM "LayoffNewsMention" m
                 WHERE m."companyKey" = b."normalizedEmployer"
                   AND m."publishedAt" BETWEEN b."noticeDate" - INTERVAL '45 days' AND b."noticeDate" + INTERVAL '45 days'
               ))) AS also_reported
        FROM base b
        WHERE NOT b.reported
           OR NOT EXISTS (
             SELECT 1 FROM base f
             WHERE NOT f.reported AND f."normalizedEmployer" = b."normalizedEmployer"
               AND f."noticeDate" BETWEEN b."noticeDate" - INTERVAL '45 days' AND b."noticeDate" + INTERVAL '45 days'
           )
      )
      -- Counted the way the table lists them: one per employer, state and
      -- date, however many sites the state filed it as.
      , grouped AS (
        SELECT k.state, MIN(k."noticeDate") AS "noticeDate", SUM(k.employees) AS employees, MAX(k."fetchedAt") AS "fetchedAt"
        FROM kept k
        GROUP BY k.state, k.gkey, k."noticeDate"::date, k.reported
      )
      SELECT COUNT(*) FILTER (WHERE "noticeDate" > NOW() - INTERVAL '30 days')::int AS n30,
             SUM(employees) FILTER (WHERE "noticeDate" > NOW() - INTERVAL '30 days')::int AS w30,
             COUNT(DISTINCT state) FILTER (WHERE "noticeDate" > NOW() - INTERVAL '30 days')::int AS s30,
             COUNT(*) FILTER (WHERE "noticeDate" >= ${yearStart})::int AS ny,
             SUM(employees) FILTER (WHERE "noticeDate" >= ${yearStart})::int AS wy,
             COUNT(DISTINCT state) FILTER (WHERE "noticeDate" >= ${yearStart})::int AS sy,
             COUNT(*)::int AS n, COUNT(DISTINCT state)::int AS s,
             MIN("noticeDate") AS since, MAX("fetchedAt") AS fetched,
             -- A state counts as covered when its own record was read
             -- successfully in the last two weeks, whether or not it had
             -- anything new.
             (SELECT COUNT(DISTINCT state)::int FROM "WarnSyncRun"
               WHERE state ~ '^[A-Z]{2}$' AND error IS NULL AND "finishedAt" IS NOT NULL
                 AND "startedAt" > NOW() - INTERVAL '14 days') AS covered
      FROM grouped`

    if (!stats || rows.length === 0) return null
    return {
      rows: rows.map((r) => ({
        key: r.key,
        // Several sites under one name: the bracketed address of whichever
        // row sorted first would describe only one of them.
        employer: cleanEmployer(r.sites > 1 ? r.employer.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+-\s+.*$/, '') : r.employer, r.company),
        state: r.state ?? 'US',
        county: r.county?.replace(/\s+County$/i, '') ?? null,
        workers: r.workers,
        sites: r.sites,
        noticeDate: day(r.notice_date),
        effectiveDate: r.effective_date ? day(r.effective_date) : null,
        // On a layoffs.fyi row this field holds the company's funding stage
        // ("Post-IPO"), which is not a kind of layoff.
        type: r.reported && /layoffs\.fyi/i.test(r.source_url ?? '') ? null : readableType(r.type),
        sourceUrl: r.source_url && /^https:\/\//.test(r.source_url) ? r.source_url : null,
        origin: r.reported ? 'reported' as const : 'state' as const,
        sourceLabel: r.reported ? reportedLabel(r.source_url) : 'State record',
        alsoReported: !!r.also_reported,
      })),
      year: { year: yearStart.getUTCFullYear(), layoffs: stats.ny, workers: stats.wy ?? 0, states: stats.sy },
      last30: { notices: stats.n30, workers: stats.w30 ?? 0, states: stats.s30 },
      total: { notices: stats.n, states: stats.s, since: stats.since ? stats.since.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: TZ }) : '' },
      statesCovered: stats.covered,
      updatedLabel: stats.fetched ? day(stats.fetched) : '',
    }
  } catch (e) {
    console.error('Layoff tracker could not be loaded', e)
    return null
  }
}
