import 'server-only'
import { prisma } from '@/lib/prisma'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'
import { buildOpeningRow, closeArchivedOpenings, upsertOpenings, type OpeningRow } from '@/lib/companies/job-openings'
import {
  AREA_SHRINK_K,
  BENCHMARK_WINDOW_DAYS,
  IN_LINE_BAND,
  MIN_AREA_SAMPLE,
  MIN_EMPLOYER_PAY_SAMPLE,
  MIN_NATIONAL_SAMPLE,
  MIN_STATE_SAMPLE,
} from '@/lib/pay/market-pay'

// The company hiring index, rebuilt nightly by /api/cron/company-hiring-index:
//   1. every open-source board posting has a Company and a CompanyJobOpening row
//   2. market pay benchmarks (PayBenchmark, PayAreaIndex) from posted pay
//   3. each opening and live posting gets its market range and above/in line/below
//   4. each company's CompanyHiringProfile (footprint, what it hires, layoffs, pay level)
// Everything is set-based SQL over our own tables: no model, no paid API.

// Sources whose listings are exclusive, private or a candidate's own lead — never
// copied into the public opening history.
const PRIVATE_SOURCES = ['employer', 'recruiter', 'candidate_check', 'candidate_referral']

/** Links board postings that have no Company yet. Bounded per run. */
export async function linkUnlinkedPostings(limit = 2000): Promise<number> {
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { companyId: null },
    select: { id: true, companyName: true },
    take: limit,
  })
  if (rows.length === 0) return 0
  const ids = await linkPostingsToCompanies(rows.map((r) => r.companyName))
  let linked = 0
  const byCompany = new Map<string, string[]>()
  for (const r of rows) {
    const companyId = ids.get(r.companyName)
    if (!companyId) continue
    byCompany.set(companyId, [...(byCompany.get(companyId) ?? []), r.id])
  }
  for (const [companyId, postingIds] of byCompany) {
    const res = await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: postingIds }, companyId: null }, data: { companyId } })
    linked += res.count
  }
  return linked
}

/**
 * Copies open-source board postings that have no opening row yet (the ATS feed, admin
 * adds, anything written before the history existed). Bounded per run; the import
 * route writes ncrawl jobs itself.
 */
export async function syncBoardOpenings(limit = 10_000): Promise<number> {
  const postings = await prisma.$queryRawUnsafe<
    {
      url: string; title: string; companyName: string; companyId: string; location: string | null; level: string | null
      industry: string | null; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null
      postedAt: Date | null; sourceName: string | null; createdAt: Date; lastConfirmedAt: Date | null; archivedAt: Date | null
    }[]
  >(
    `SELECT p.url, p.title, p."companyName", p."companyId", p.location, p.level, p.industry, p."salaryMin", p."salaryMax",
            p."salaryCurrency", p."postedAt", p."sourceName", p."createdAt", p."lastConfirmedAt", p."archivedAt"
     FROM "ExclusiveJobPosting" p
     LEFT JOIN "CompanyJobOpening" o ON o.url = p.url
     WHERE o.id IS NULL AND p."companyId" IS NOT NULL AND p.status = 'approved' AND p.disclosure = 'OPEN'
       AND p."institutionScopeId" IS NULL AND p.distribution <> 'EXCLUDED' AND NOT (p.source = ANY($1::text[]))
     LIMIT $2`,
    PRIVATE_SOURCES,
    limit
  )
  let written = 0
  for (let i = 0; i < postings.length; i += 500) {
    const rows = postings
      .slice(i, i + 500)
      .map((p) =>
        buildOpeningRow(p, p.companyId, 'board', {
          firstSeenAt: p.createdAt,
          lastSeenAt: p.archivedAt ?? p.lastConfirmedAt ?? p.createdAt,
          closedAt: p.archivedAt,
        })
      )
      .filter((r): r is OpeningRow => r !== null)
    written += await upsertOpenings(rows)
  }
  return written
}

/** Most salaries one company may contribute to a function x level benchmark. */
export const MAX_COMPANY_SHARE = 5

/** Rebuilds PayBenchmark and PayAreaIndex from posted pay. */
export async function rebuildPayBenchmarks(): Promise<{ benchmarks: number; areas: number }> {
  return prisma.$transaction(
    async (tx) => {
      // One salary per company + title + pay, so an employer posting the same role
      // fifty times counts once; and at most MAX_COMPANY_SHARE salaries per company in
      // any function x level, so a big poster can't set its own market (a Google
      // with 300 engineering salaries would otherwise largely be the benchmark it is
      // compared with).
      await tx.$executeRawUnsafe(`
        CREATE TEMP TABLE pay_base ON COMMIT DROP AS
        SELECT fn, g, st, mid FROM (
          SELECT *, row_number() OVER (PARTITION BY "companyId", fn, g ORDER BY md5(id)) AS rk FROM (
            SELECT DISTINCT ON ("companyId", lower(title), "payAnnualMid")
              id, "companyId", COALESCE(function, 'Other') AS fn, "seniorityGroup" AS g, states[1] AS st, "payAnnualMid"::float8 AS mid
            FROM "CompanyJobOpening"
            WHERE "payAnnualMid" IS NOT NULL AND "seniorityGroup" IS NOT NULL
              AND COALESCE("postedAt", "firstSeenAt") >= now() - interval '${BENCHMARK_WINDOW_DAYS} days'
          ) d
        ) c WHERE rk <= ${MAX_COMPANY_SHARE}
      `)
      await tx.$executeRawUnsafe(`DELETE FROM "PayBenchmark"`)
      // Rounded to $1,000 so a nightly rebuild only rewrites the jobs whose market
      // figure really moved.
      const pct = [0.25, 0.5, 0.75].map((q) => `(round(percentile_cont(${q}) WITHIN GROUP (ORDER BY mid) / 1000) * 1000)::int`).join(', ') + ', count(*)::int'
      const benchmarks =
        (await tx.$executeRawUnsafe(`
          INSERT INTO "PayBenchmark" (id, fn, "seniorityGroup", geo, p25, p50, p75, "sampleSize")
          SELECT 'pb' || md5(fn || g || 'US'), fn, g, 'US', ${pct} FROM pay_base GROUP BY fn, g HAVING count(*) >= ${MIN_NATIONAL_SAMPLE}
        `)) +
        (await tx.$executeRawUnsafe(`
          INSERT INTO "PayBenchmark" (id, fn, "seniorityGroup", geo, p25, p50, p75, "sampleSize")
          SELECT 'pb' || md5('*' || g || 'US'), '*', g, 'US', ${pct} FROM pay_base GROUP BY g HAVING count(*) >= ${MIN_NATIONAL_SAMPLE}
        `)) +
        (await tx.$executeRawUnsafe(`
          INSERT INTO "PayBenchmark" (id, fn, "seniorityGroup", geo, p25, p50, p75, "sampleSize")
          SELECT 'pb' || md5(fn || g || st), fn, g, st, ${pct} FROM pay_base WHERE st IS NOT NULL
          GROUP BY fn, g, st HAVING count(*) >= ${MIN_STATE_SAMPLE}
        `))

      // State pay level: each salary against its national function x level median,
      // so a state isn't "expensive" just because it posts more VP roles.
      await tx.$executeRawUnsafe(`DELETE FROM "PayAreaIndex"`)
      let areas = await tx.$executeRawUnsafe(`
        INSERT INTO "PayAreaIndex" (state, index, "sampleSize", source)
        SELECT st, 1 + (percentile_cont(0.5) WITHIN GROUP (ORDER BY r) - 1) * (count(*)::float8 / (count(*) + ${AREA_SHRINK_K})), count(*)::int, 'posted'
        FROM (
          SELECT b.st, b.mid / COALESCE(n.p50, l.p50) AS r
          FROM pay_base b
          LEFT JOIN "PayBenchmark" n ON n.fn = b.fn AND n."seniorityGroup" = b.g AND n.geo = 'US'
          LEFT JOIN "PayBenchmark" l ON l.fn = '*' AND l."seniorityGroup" = b.g AND l.geo = 'US'
          WHERE b.st IS NOT NULL AND COALESCE(n.p50, l.p50) > 0
        ) x
        GROUP BY st HAVING count(*) >= ${MIN_AREA_SAMPLE}
      `)
      // Thin states fall back to DOL LCA wages: each employer's offered wage for an
      // occupation against that occupation's national median, by the filing state.
      areas += await tx.$executeRawUnsafe(`
        INSERT INTO "PayAreaIndex" (state, index, "sampleSize", source)
        SELECT w."topState", 1 + (percentile_cont(0.5) WITHIN GROUP (ORDER BY w."wageMedian"::float8 / s.med) - 1) * (count(*)::float8 / (count(*) + ${AREA_SHRINK_K})), count(*)::int, 'lca'
        FROM "OfferedWageSummary" w
        JOIN (SELECT "socCode", percentile_cont(0.5) WITHIN GROUP (ORDER BY "wageMedian") AS med FROM "OfferedWageSummary" GROUP BY "socCode" HAVING count(*) >= 5) s
          ON s."socCode" = w."socCode"
        WHERE w."topState" ~ '^[A-Z]{2}$' AND s.med > 0
          AND NOT EXISTS (SELECT 1 FROM "PayAreaIndex" a WHERE a.state = w."topState")
        GROUP BY w."topState" HAVING count(*) >= 10
      `)
      return { benchmarks, areas }
    },
    { timeout: 120_000 }
  )
}

/**
 * Sets each opening's market range and, where pay is posted, its verdict; then copies
 * both onto the live board posting with the same URL. `urls` limits it to a batch
 * (the import route); omitted, it covers every row that changed.
 */
export async function applyMarketPay(urls?: string[]): Promise<{ openings: number; postings: number }> {
  if (urls) return priceOpenings('url', urls)
  return priceOpeningsPaged(await openingIdsToPrice({ all: true }))
}

export interface PagingOptions {
  /** Stop starting new pages after this time (ms epoch); leftovers wait for the next run. */
  deadline?: number
  /** Pause between pages, so checkpoints keep up and live traffic isn't starved. */
  pauseMs?: number
  /** Called after each page; return false to stop. */
  onPage?: (done: number, total: number) => Promise<boolean | void>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Prices openings by id, MARKET_PAGE ids per statement. */
export async function priceOpeningsPaged(ids: string[], opts: PagingOptions = {}) {
  const total = { openings: 0, postings: 0, pages: 0, remaining: 0 }
  for (let i = 0; i < ids.length; i += MARKET_PAGE) {
    if (opts.deadline && Date.now() > opts.deadline) {
      total.remaining = ids.length - i
      break
    }
    const r = await priceOpenings('id', ids.slice(i, i + MARKET_PAGE))
    total.openings += r.openings
    total.postings += r.postings
    total.pages++
    if (opts.onPage && (await opts.onPage(Math.min(i + MARKET_PAGE, ids.length), ids.length)) === false) {
      total.remaining = ids.length - Math.min(i + MARKET_PAGE, ids.length)
      break
    }
    if (opts.pauseMs) await sleep(opts.pauseMs)
  }
  return total
}

/** Nightly shards: every opening and company is fully repriced/reprofiled once a week. */
export const SHARDS = 7

/**
 * Openings to price: everything (`all`), or those whose content changed since the
 * last run, those never priced, and this night's shard of the rest.
 */
export async function openingIdsToPrice(opts: { all?: boolean; since?: Date; shard?: number }): Promise<string[]> {
  const rows = opts.all
    ? await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "CompanyJobOpening" ORDER BY id`)
    : await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "CompanyJobOpening"
         WHERE "updatedAt" >= $1 OR ("marketPayMid" IS NULL AND "seniorityGroup" IS NOT NULL) OR mod(abs(hashtext(id)), ${SHARDS}) = $2
         ORDER BY id`,
        opts.since ?? new Date(0),
        opts.shard ?? 0
      )
  return rows.map((r) => r.id)
}

/** Companies to reprofile: changed openings or WARN notices since the last run, no profile yet, or this night's shard. */
export async function companyIdsToProfile(opts: { all?: boolean; since?: Date; shard?: number }): Promise<string[]> {
  const rows = opts.all
    ? await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT DISTINCT "companyId" AS id FROM "CompanyJobOpening" ORDER BY 1`)
    : await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT DISTINCT o."companyId" AS id FROM "CompanyJobOpening" o
         LEFT JOIN "CompanyHiringProfile" h ON h."companyId" = o."companyId"
         WHERE o."updatedAt" >= $1 OR h.id IS NULL OR mod(abs(hashtext(o."companyId")), ${SHARDS}) = $2
         UNION
         SELECT DISTINCT w."companyId" FROM "WarnNotice" w
         WHERE w."companyId" IS NOT NULL AND w."fetchedAt" >= $1
           AND EXISTS (SELECT 1 FROM "CompanyJobOpening" x WHERE x."companyId" = w."companyId")
         ORDER BY 1`,
        opts.since ?? new Date(0),
        opts.shard ?? 0
      )
  return rows.map((r) => r.id)
}

const MARKET_PAGE = 5_000

async function priceOpenings(key: 'url' | 'id', values: string[]): Promise<{ openings: number; postings: number }> {
  const scope = `AND o.${key} = ANY($1::text[])`
  const params = [values]
  const openings = await prisma.$executeRawUnsafe(
    `
    WITH m AS (
      SELECT o.id,
        CASE WHEN s.p50 IS NOT NULL THEN s.p25 WHEN n.p50 IS NOT NULL THEN round(n.p25 * COALESCE(a.index, 1) / 1000) * 1000 WHEN l.p50 IS NOT NULL THEN round(l.p25 * COALESCE(a.index, 1) / 1000) * 1000 END::int AS lo,
        CASE WHEN s.p50 IS NOT NULL THEN s.p50 WHEN n.p50 IS NOT NULL THEN round(n.p50 * COALESCE(a.index, 1) / 1000) * 1000 WHEN l.p50 IS NOT NULL THEN round(l.p50 * COALESCE(a.index, 1) / 1000) * 1000 END::int AS mid,
        CASE WHEN s.p50 IS NOT NULL THEN s.p75 WHEN n.p50 IS NOT NULL THEN round(n.p75 * COALESCE(a.index, 1) / 1000) * 1000 WHEN l.p50 IS NOT NULL THEN round(l.p75 * COALESCE(a.index, 1) / 1000) * 1000 END::int AS hi,
        CASE WHEN s.p50 IS NOT NULL THEN 'state:' || s.geo
             WHEN n.p50 IS NOT NULL THEN CASE WHEN a.state IS NOT NULL THEN 'national_adjusted:' || a.state ELSE 'national:US' END
             WHEN l.p50 IS NOT NULL THEN CASE WHEN a.state IS NOT NULL THEN 'level_adjusted:' || a.state ELSE 'level:US' END END AS basis,
        COALESCE(s."sampleSize", n."sampleSize", l."sampleSize") AS sample,
        o."payAnnualMid" AS posted
      FROM "CompanyJobOpening" o
      LEFT JOIN "PayBenchmark" s ON s.fn = COALESCE(o.function, 'Other') AND s."seniorityGroup" = o."seniorityGroup" AND s.geo = o.states[1]
      LEFT JOIN "PayBenchmark" n ON n.fn = COALESCE(o.function, 'Other') AND n."seniorityGroup" = o."seniorityGroup" AND n.geo = 'US'
      LEFT JOIN "PayBenchmark" l ON l.fn = '*' AND l."seniorityGroup" = o."seniorityGroup" AND l.geo = 'US'
      LEFT JOIN "PayAreaIndex" a ON a.state = o.states[1]
      WHERE TRUE ${scope}
    ), v AS (
      SELECT m.*,
        CASE WHEN posted IS NOT NULL AND mid > 0 THEN round((posted::numeric / mid), 2)::float8 END AS ratio
      FROM m
    )
    UPDATE "CompanyJobOpening" o SET
      "marketPayLow" = v.lo, "marketPayMid" = v.mid, "marketPayHigh" = v.hi, "marketPayBasis" = v.basis,
      "marketPaySample" = v.sample, "payRatio" = v.ratio,
      "payVsMarket" = CASE WHEN v.ratio IS NULL THEN NULL WHEN v.ratio > ${1 + IN_LINE_BAND} THEN 'above' WHEN v.ratio < ${1 - IN_LINE_BAND} THEN 'below' ELSE 'in_line' END
    FROM v
    WHERE o.id = v.id AND (
      o."marketPayMid" IS DISTINCT FROM v.mid OR o."marketPayLow" IS DISTINCT FROM v.lo OR o."marketPayHigh" IS DISTINCT FROM v.hi
      OR o."marketPayBasis" IS DISTINCT FROM v.basis OR o."marketPaySample" IS DISTINCT FROM v.sample OR o."payRatio" IS DISTINCT FROM v.ratio
    )
    `,
    ...params
  )
  const postings = await prisma.$executeRawUnsafe(
    `
    UPDATE "ExclusiveJobPosting" p SET
      "marketPayLow" = o."marketPayLow", "marketPayMid" = o."marketPayMid", "marketPayHigh" = o."marketPayHigh",
      "marketPayBasis" = o."marketPayBasis", "marketPaySample" = o."marketPaySample", "payVsMarket" = o."payVsMarket"
    FROM "CompanyJobOpening" o
    WHERE o.url = p.url ${scope} ${key === 'id' ? 'AND p."archivedAt" IS NULL' : ''}
      AND (p."marketPayMid" IS DISTINCT FROM o."marketPayMid" OR p."marketPayLow" IS DISTINCT FROM o."marketPayLow"
        OR p."marketPayHigh" IS DISTINCT FROM o."marketPayHigh" OR p."marketPayBasis" IS DISTINCT FROM o."marketPayBasis"
        OR p."marketPaySample" IS DISTINCT FROM o."marketPaySample" OR p."payVsMarket" IS DISTINCT FROM o."payVsMarket")
    `,
    ...params
  )
  return { openings, postings }
}

/**
 * Rebuilds CompanyHiringProfile for every company with an opening (or for the given
 * companies), and mirrors the WARN counts onto each company's latest CompanySignal.
 */
export async function rebuildHiringProfiles(companyIds?: string[]): Promise<number> {
  const scope = companyIds ? `AND o."companyId" = ANY($1::text[])` : ''
  const params = companyIds ? [companyIds] : []
  const written = await prisma.$executeRawUnsafe(
    `
    WITH o AS (
      SELECT o.*, COALESCE(o."postedAt", o."firstSeenAt") AS opened,
        CASE WHEN NOT o."isRemote" AND o.location IS NOT NULL THEN lower(trim(split_part(o.location, ',', 1))) || '|' || COALESCE(o.states[1], '') END AS site
      FROM "CompanyJobOpening" o WHERE TRUE ${scope}
    ),
    agg AS (
      SELECT "companyId",
        count(*) FILTER (WHERE "closedAt" IS NULL) AS open_now,
        count(*) FILTER (WHERE opened >= now() - interval '90 days') AS opened_90,
        count(*) FILTER (WHERE opened >= now() - interval '365 days') AS opened_365,
        count(*) AS total,
        min(opened) AS first_seen, max("lastSeenAt") AS last_seen,
        avg(CASE WHEN "isRemote" THEN 1 ELSE 0 END)::float8 AS remote_share,
        count(DISTINCT site) AS sites,
        count(*) FILTER (WHERE "isRemote") AS remote_n,
        avg(CASE WHEN "seniorityGroup" IN ('EXECUTIVE','VP','DIRECTOR') THEN 1.0 ELSE 0.0 END) FILTER (WHERE "seniorityGroup" IS NOT NULL)::float8 AS dir_plus,
        avg(CASE WHEN "seniorityGroup" IN ('EXECUTIVE','VP') THEN 1.0 ELSE 0.0 END) FILTER (WHERE "seniorityGroup" IS NOT NULL)::float8 AS vp_plus,
        avg(CASE WHEN "payAnnualMid" IS NOT NULL THEN 1.0 ELSE 0.0 END)::float8 AS posted_pay_share,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY "payRatio") FILTER (WHERE "payRatio" IS NOT NULL AND opened >= now() - interval '${BENCHMARK_WINDOW_DAYS} days') AS pay_ratio,
        count("payRatio") FILTER (WHERE opened >= now() - interval '${BENCHMARK_WINDOW_DAYS} days') AS pay_n,
        mode() WITHIN GROUP (ORDER BY industry) AS crawler_industry
      FROM o GROUP BY "companyId"
    ),
    st AS (
      SELECT "companyId", array_agg(s ORDER BY n DESC, s) AS states FROM (
        SELECT "companyId", unnest(states) AS s, count(*) AS n FROM o GROUP BY 1, 2
      ) x GROUP BY 1
    ),
    loc AS (
      SELECT "companyId", jsonb_agg(jsonb_build_object('location', location, 'count', n) ORDER BY n DESC, location) AS top FROM (
        SELECT "companyId", location, n, row_number() OVER (PARTITION BY "companyId" ORDER BY n DESC, location) AS rk FROM (
          SELECT "companyId", location, count(*) AS n FROM o WHERE location IS NOT NULL GROUP BY 1, 2
        ) a
      ) b WHERE rk <= 8 GROUP BY 1
    ),
    fn AS (
      SELECT "companyId", jsonb_agg(jsonb_build_object('function', function, 'count', n) ORDER BY n DESC, function) AS top FROM (
        SELECT "companyId", function, n, row_number() OVER (PARTITION BY "companyId" ORDER BY n DESC, function) AS rk FROM (
          SELECT "companyId", function, count(*) AS n FROM o WHERE function IS NOT NULL GROUP BY 1, 2
        ) a
      ) b WHERE rk <= 6 GROUP BY 1
    ),
    lv AS (
      SELECT "companyId", jsonb_agg(jsonb_build_object('group', "seniorityGroup", 'count', n) ORDER BY n DESC) AS mix FROM (
        SELECT "companyId", "seniorityGroup", count(*) AS n FROM o WHERE "seniorityGroup" IS NOT NULL GROUP BY 1, 2
      ) a GROUP BY 1
    ),
    warn AS (
      SELECT w."companyId",
        count(*) FILTER (WHERE w."noticeDate" >= now() - interval '365 days') AS filings,
        COALESCE(sum(w.employees) FILTER (WHERE w."noticeDate" >= now() - interval '365 days'), 0) AS employees,
        max(w."noticeDate") AS last_at
      FROM "WarnNotice" w WHERE w."companyId" IN (SELECT "companyId" FROM agg) GROUP BY 1
    ),
    news AS (
      SELECT c.id AS "companyId", count(*) AS n
      FROM "LayoffNewsMention" m JOIN "Company" c ON c."canonicalNameNormalized" = m."companyKey"
      WHERE m."publishedAt" >= now() - interval '365 days' AND c.id IN (SELECT "companyId" FROM agg) GROUP BY 1
    )
    INSERT INTO "CompanyHiringProfile" (
      id, "companyId", industry, "siteType", states, "topLocations", "remoteShare", "topFunctions", "levelMix",
      "directorPlusShare", "vpPlusShare", "openNow", "opened90d", "opened12mo", "totalSeen", "firstSeenAt", "lastSeenAt",
      "warnFilings12mo", "warnEmployees12mo", "lastWarnAt", "layoffNews12mo", "payLevel", "payLevelSample", "payLevelRatio",
      "postedPayShare", "computedAt"
    )
    SELECT 'chp' || substr(md5(agg."companyId"), 1, 22), agg."companyId", COALESCE(c.industry, agg.crawler_industry),
      CASE WHEN agg.sites > 1 THEN 'multi_site' WHEN agg.sites = 1 THEN 'single_site' WHEN agg.remote_n > 0 THEN 'remote_only' ELSE 'unknown' END,
      COALESCE(st.states, ARRAY[]::text[]), loc.top, agg.remote_share, fn.top, lv.mix, agg.dir_plus, agg.vp_plus,
      agg.open_now, agg.opened_90, agg.opened_365, agg.total, agg.first_seen, agg.last_seen,
      COALESCE(warn.filings, 0), COALESCE(warn.employees, 0), warn.last_at, COALESCE(news.n, 0),
      CASE WHEN agg.pay_n < ${MIN_EMPLOYER_PAY_SAMPLE} THEN 'insufficient' WHEN agg.pay_ratio > ${1 + IN_LINE_BAND} THEN 'high'
           WHEN agg.pay_ratio < ${1 - IN_LINE_BAND} THEN 'low' ELSE 'in_line' END,
      agg.pay_n, CASE WHEN agg.pay_n >= ${MIN_EMPLOYER_PAY_SAMPLE} THEN agg.pay_ratio END, agg.posted_pay_share, now()
    FROM agg
    JOIN "Company" c ON c.id = agg."companyId"
    LEFT JOIN st ON st."companyId" = agg."companyId"
    LEFT JOIN loc ON loc."companyId" = agg."companyId"
    LEFT JOIN fn ON fn."companyId" = agg."companyId"
    LEFT JOIN lv ON lv."companyId" = agg."companyId"
    LEFT JOIN warn ON warn."companyId" = agg."companyId"
    LEFT JOIN news ON news."companyId" = agg."companyId"
    ON CONFLICT ("companyId") DO UPDATE SET
      industry = EXCLUDED.industry, "siteType" = EXCLUDED."siteType", states = EXCLUDED.states,
      "topLocations" = EXCLUDED."topLocations", "remoteShare" = EXCLUDED."remoteShare", "topFunctions" = EXCLUDED."topFunctions",
      "levelMix" = EXCLUDED."levelMix", "directorPlusShare" = EXCLUDED."directorPlusShare", "vpPlusShare" = EXCLUDED."vpPlusShare",
      "openNow" = EXCLUDED."openNow", "opened90d" = EXCLUDED."opened90d", "opened12mo" = EXCLUDED."opened12mo",
      "totalSeen" = EXCLUDED."totalSeen", "firstSeenAt" = EXCLUDED."firstSeenAt", "lastSeenAt" = EXCLUDED."lastSeenAt",
      "warnFilings12mo" = EXCLUDED."warnFilings12mo", "warnEmployees12mo" = EXCLUDED."warnEmployees12mo",
      "lastWarnAt" = EXCLUDED."lastWarnAt", "layoffNews12mo" = EXCLUDED."layoffNews12mo", "payLevel" = EXCLUDED."payLevel",
      "payLevelSample" = EXCLUDED."payLevelSample", "payLevelRatio" = EXCLUDED."payLevelRatio",
      "postedPayShare" = EXCLUDED."postedPayShare", "computedAt" = now()
    `,
    ...params
  )

  // The WARN columns on CompanySignal were reserved for exactly this; fill the latest
  // week for every company that has a profile.
  await prisma.$executeRawUnsafe(
    `
    UPDATE "CompanySignal" s SET "warnFilings12mo" = h."warnFilings12mo", "warnEmployeesAffected" = h."warnEmployees12mo"
    FROM "CompanyHiringProfile" h
    WHERE h."companyId" = s."companyId" ${companyIds ? 'AND h."companyId" = ANY($1::text[])' : ''}
      AND s."weekStartDate" = (SELECT max("weekStartDate") FROM "CompanySignal")
      AND (s."warnFilings12mo" IS DISTINCT FROM h."warnFilings12mo" OR s."warnEmployeesAffected" IS DISTINCT FROM h."warnEmployees12mo")
    `,
    ...params
  )
  return written
}

/** Every company's profile, a few thousand companies per statement. */
/** Profiles for the given companies, PROFILE_PAGE companies per statement. */
export async function rebuildHiringProfilesPaged(ids: string[], opts: PagingOptions = {}) {
  const total = { written: 0, pages: 0, remaining: 0 }
  for (let i = 0; i < ids.length; i += PROFILE_PAGE) {
    if (opts.deadline && Date.now() > opts.deadline) {
      total.remaining = ids.length - i
      break
    }
    total.written += await rebuildHiringProfiles(ids.slice(i, i + PROFILE_PAGE))
    total.pages++
    if (opts.onPage && (await opts.onPage(Math.min(i + PROFILE_PAGE, ids.length), ids.length)) === false) {
      total.remaining = ids.length - Math.min(i + PROFILE_PAGE, ids.length)
      break
    }
    if (opts.pauseMs) await sleep(opts.pauseMs)
  }
  return total
}

const PROFILE_PAGE = 1_000

/**
 * The nightly run, incremental: links and copies new postings, closes archived
 * ones, then prices and profiles only what changed since the last successful run
 * plus one seventh of everything (so all of it is refreshed weekly). Benchmarks are
 * rebuilt on shard 0 (Sundays, UTC), before that night's repricing. Work that would
 * outrun the deadline waits for the next night.
 *
 * Skips the heavy steps while the ncrawl import is writing (a batch confirmed in the
 * last 10 minutes), so the two big writers never overlap.
 */
export async function rebuildHiringIndex(opts: { since: Date | null; now?: Date; budgetMs?: number }) {
  const now = opts.now ?? new Date()
  const started = Date.now()
  const deadline = started + (opts.budgetMs ?? 230_000)
  const shard = now.getUTCDay() % SHARDS
  const ms: Record<string, number> = {}
  const timed = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t = Date.now()
    try {
      return await fn()
    } finally {
      ms[name] = Date.now() - t
    }
  }
  const importing = await prisma.exclusiveJobPosting.count({
    where: { addedBy: 'ncrawl', lastConfirmedAt: { gte: new Date(now.getTime() - 10 * 60_000) } },
  })
  if (importing > 0) return { skipped: 'ncrawl import in progress', importing }

  const linked = await timed('link', () => linkUnlinkedPostings(1000))
  const synced = await timed('sync', () => syncBoardOpenings(5000))
  const closed = await timed('close', () => closeArchivedOpenings())
  const bench = shard === 0 ? await timed('benchmarks', () => rebuildPayBenchmarks()) : null
  const since = opts.since ?? new Date(0)
  const market = await timed('market', async () =>
    priceOpeningsPaged(await openingIdsToPrice({ since, shard }), { deadline, pauseMs: 500 })
  )
  const profiles = await timed('profiles', async () =>
    rebuildHiringProfilesPaged(await companyIdsToProfile({ since, shard }), { deadline: deadline + 40_000, pauseMs: 500 })
  )
  return { shard, since: since.toISOString(), linked, synced, closed, bench, market, profiles, ms }
}
