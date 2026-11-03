import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerSlug } from './layoff-pages'
import { MERGE_WINDOW_DAYS, mergeReported, type LooseNotice, type MergedLayoff } from './tracker-merge'
import { sameEmployer } from './news-headline'

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
  /** A reported layoff with a single source so far; a second publisher or a filing confirms it. */
  unconfirmed: boolean
  /** /layoffs/company/<slug>, for state filings only. */
  companySlug: string | null
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

const DAY_MS = 86_400_000

/**
 * Layoffs reported with no U.S. state, from the last 45 days, merged across outlets (one line per layoff, the headcount most
 * reports agree on) and with any that a state filing already covers left out, as for reported layoffs that name a state.
 */
async function looseReportedRows(): Promise<MergedLayoff[]> {
  const now = new Date()
  const since = new Date(now.getTime() - MERGE_WINDOW_DAYS * DAY_MS)
  const [notices, filings] = await Promise.all([
    prisma.warnNotice.findMany({
      where: { dismissedAt: null, state: null, source: 'MANUAL_ANNOUNCEMENT', noticeDate: { gte: since, lte: now } },
      select: { id: true, employer: true, normalizedEmployer: true, companyId: true, employees: true, noticeDate: true, effectiveDate: true, layoffType: true, sourceUrl: true },
      take: 3000,
    }),
    prisma.warnNotice.findMany({
      where: { dismissedAt: null, source: 'WARN_FILING', state: { not: null }, noticeDate: { gte: new Date(since.getTime() - MERGE_WINDOW_DAYS * DAY_MS), lte: new Date(now.getTime() + MERGE_WINDOW_DAYS * DAY_MS) } },
      select: { normalizedEmployer: true, noticeDate: true },
    }),
  ])
  if (notices.length === 0) return []
  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId: { in: notices.map((n) => n.id) } },
    select: { noticeId: true, publisher: true },
  })
  const publishers = new Map<string, string[]>()
  for (const m of mentions) if (m.noticeId && m.publisher) publishers.set(m.noticeId, [...(publishers.get(m.noticeId) ?? []), m.publisher])

  const loose: LooseNotice[] = notices.flatMap((n) => n.noticeDate ? [{ ...n, noticeDate: n.noticeDate, publishers: publishers.get(n.id) ?? [] }] : [])
  return mergeReported(loose).filter((m) => !filings.some((f) =>
    f.noticeDate && Math.abs(f.noticeDate.getTime() - m.noticeDate.getTime()) <= MERGE_WINDOW_DAYS * DAY_MS && sameEmployer(f.normalizedEmployer, m.normalizedEmployer)))
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
        -- Only layoffs attributed to a U.S. state. An announcement with no state (a company's global cuts, a foreign
        -- government) is not a U.S. layoff: 128 of them, 335,448 workers, were half of this year's headline total
        -- until 2026-10-27 (src/lib/warn/layoff-counts.ts says what is left out).
        WHERE w."dismissedAt" IS NULL AND w."state" IS NOT NULL AND w."noticeDate" IS NOT NULL AND w."noticeDate" <= NOW()
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
        -- Only layoffs attributed to a U.S. state. An announcement with no state (a company's global cuts, a foreign
        -- government) is not a U.S. layoff: 128 of them, 335,448 workers, were half of this year's headline total
        -- until 2026-10-27 (src/lib/warn/layoff-counts.ts says what is left out).
        WHERE w."dismissedAt" IS NULL AND w."state" IS NOT NULL AND w."noticeDate" IS NOT NULL AND w."noticeDate" <= NOW()
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

    // Layoffs reported with no U.S. state (most news stories, some SEC filings). They are listed, merged across outlets, but
    // not counted in the totals: see getLayoffCounts and the note under the table.
    const loose = limit > 1 ? await looseReportedRows().catch((e) => { console.error('Reported layoffs could not be loaded', e); return [] }) : []
    const stateRows = rows.map((r) => ({
      at: r.notice_date,
      row: {
        key: r.key,
        // Several sites under one name: the bracketed address of whichever
        // row sorted first would describe only one of them.
        employer: cleanEmployer(r.sites > 1 ? r.employer.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+-\s+.*$/, '') : r.employer, r.company),
        state: r.state ?? 'US', // never null since 2026-10-27 (the query keeps only rows with a state); kept for the type
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
        unconfirmed: false,
        companySlug: r.reported ? null : employerSlug(r.employer, r.company) || null,
      } satisfies TrackerRow,
    }))
    const looseRows = loose.map((m) => ({
      at: m.noticeDate,
      row: {
        key: m.key,
        employer: m.employer,
        state: '',
        county: null,
        workers: m.employees,
        sites: 1,
        noticeDate: day(m.noticeDate),
        effectiveDate: m.effectiveDate ? day(m.effectiveDate) : null,
        type: /layoffs\.fyi/i.test(m.sourceUrl ?? '') ? null : readableType(m.layoffType?.replace(/^Reported by[^·—-]*[·—-]?\s*/i, '') ?? null),
        sourceUrl: m.sourceUrl && /^https:\/\//.test(m.sourceUrl) && !/news\.google\.com/.test(m.sourceUrl) ? m.sourceUrl : null,
        origin: 'reported' as const,
        sourceLabel: reportedLabel(m.sourceUrl),
        alsoReported: m.sources >= 2,
        unconfirmed: m.sources < 2,
        companySlug: null,
      } satisfies TrackerRow,
    }))
    const merged = [...stateRows, ...looseRows].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit).map((x) => x.row)

    return {
      rows: merged,
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
