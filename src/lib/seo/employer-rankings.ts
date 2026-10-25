import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { employerSlug } from '@/lib/seo/employer-slug'
import { employerPageCompanyIds } from '@/lib/seo/employer-pages'
import { JOB_FUNCTIONS } from '@/lib/seo/topics'

// Public employer rankings (/top-employers, /top-employers/<function>) and the monthly report's employer table.
// Every figure is counted from the open board, per role (rows sharing a crawlerFingerprint count once, as in
// src/lib/marketing/workforce-numbers.ts), and only for employers the board shows by name to everyone.
//
//   entry       roles at level ENTRY_IC / EARLY_IC
//   noExp       entry roles whose posting says people without experience are welcome (postingSignals no_experience_ok)
//   training    entry roles describing structured training for the hire (training_provided)
//   aiSkill     roles asking for a specific AI skill (aiSkillGroups) — the strict, public AI metric
//   (Staffing and search firms are left out: they post for other employers, so ranking them as hirers is wrong.)
//   layoffs     press headlines in the last 12 months that name AI or automation next to a layoff, an allowlist
//               match on the headline (LayoffNewsMention); a floor, and what the press said, not the employer's cause
//
// Rankings that compare employers by a share (AI-skill share) need SHARE_MIN_ROLES open roles first, so a
// two-job employer with one AI job does not outrank a company with a hundred.

export const SHARE_MIN_ROLES = 25
const WIDELY_REPORTED = 3
export const RANK_SIZE = 25
export const FUNCTION_RANK_SIZE = 15

const LIVE = `"status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND "orgScopeId" IS NULL
  AND COALESCE("distribution", '') = 'OPEN' AND COALESCE("disclosure", 'OPEN') = 'OPEN'
  AND ("expiresAt" IS NULL OR "expiresAt" > now()) AND COALESCE("employmentType", '') NOT IN ('internship', 'co_op', 'coop')
  AND COALESCE("postingType", '') <> 'recruiter_search' AND COALESCE("sourceCategory", '') <> 'search_firm'`

/** Employers that hire for others (a Company classed as staffing, or named like a staffing / search / job-scam site). */
const NOT_STAFFING = `c.industry IS DISTINCT FROM 'Staffing & Human Capital'
  AND COALESCE(c.name, r."companyName") !~* '(staffing|recruit|talent|\\msearch\\M|work at home|workforce solutions|headhunt)'
  AND COALESCE(c.name, r."companyName") !~* '^(confidential|company confidential|confidential company|remote|clients? blackbox|stealth.*|undisclosed|anonymous|various|multiple companies|hiring now|our client)$'`

/** Headline words that tie a layoff to AI. An allowlist: nothing else counts. */
const AI_HEADLINE = `\\m(AI|A\\.I\\.|artificial intelligence|generative AI|genAI|automation|automating|automated|machine learning)\\M`

/** Headlines that say AI is not the reason; they name AI but argue against the link. */
const AI_DENIAL = `(denies|denied|not behind|not due to|not because|not AI|isn.t buying|no evidence)`

export interface RankedEmployer {
  name: string
  /** /employers/<slug> when that page exists, else null. */
  slug: string | null
  open: number
  entry: number
  noExp: number
  training: number
  aiSkill: number
  /** aiSkill / open, 0-1. */
  aiShare: number
}

export interface AiLayoffEmployer {
  name: string
  slug: string | null
  /** Distinct news outlets that ran an AI-linked layoff headline for this employer (syndicated copies count once). */
  outlets: number
  latest: { headline: string; url: string; publisher: string | null; publishedAt: string | null }
}

export interface EmployerRankings {
  asOf: string
  totalOpen: number
  totalEntry: number
  /** Most entry-level roles open. */
  entry: RankedEmployer[]
  /** Most entry roles that say no experience is needed. */
  noExp: RankedEmployer[]
  /** Highest share of open roles asking for AI skills (employers with SHARE_MIN_ROLES+ roles). */
  aiShare: RankedEmployer[]
  /** Most open roles asking for AI skills. */
  aiCount: RankedEmployer[]
  /** Employers with press headlines tying a recent layoff to AI. */
  aiLayoffs: AiLayoffEmployer[]
  /** Both sides: employers on the AI hiring list that also appear on the AI layoffs list. */
  both: string[]
}

type Row = {
  key: string
  name: string
  company_id: string | null
  canonical: string | null
  open: number
  entry: number
  no_exp: number
  training: number
  ai_skill: number
}

// One pass over the open board, grouped by employer. Cached in the caller.
const ROLES_CTE = `WITH roles AS (
    SELECT DISTINCT ON (COALESCE("crawlerFingerprint", "id"))
      "companyId", "companyName", "level", "postingSignals", "aiSkillGroups", "targetFunction"
    FROM "ExclusiveJobPosting" WHERE ${LIVE}
    ORDER BY COALESCE("crawlerFingerprint", "id"), "lastVerifiedAt" DESC NULLS LAST, "createdAt" DESC
  )`

const AGG = `count(*)::int AS open,
      count(*) FILTER (WHERE r."level" IN ('ENTRY_IC', 'EARLY_IC'))::int AS entry,
      count(*) FILTER (WHERE r."level" IN ('ENTRY_IC', 'EARLY_IC') AND 'no_experience_ok' = ANY(r."postingSignals"))::int AS no_exp,
      count(*) FILTER (WHERE r."level" IN ('ENTRY_IC', 'EARLY_IC') AND 'training_provided' = ANY(r."postingSignals"))::int AS training,
      count(*) FILTER (WHERE cardinality(r."aiSkillGroups") > 0)::int AS ai_skill`

const KEYED = `COALESCE(r."companyId", lower(r."companyName")) AS key, COALESCE(c.name, max(r."companyName")) AS name, r."companyId" AS company_id, c."canonicalNameNormalized" AS canonical`
const JOIN = `LEFT JOIN "Company" c ON c.id = r."companyId"`

function toRanked(r: Row, pages: Set<string>): RankedEmployer {
  // Link only to employers that have a page (the same rule as the employer sitemap), so no ranking row 404s.
  const linked = r.canonical && r.company_id && pages.has(r.company_id)
  return {
    name: r.name,
    slug: linked ? employerSlug(r.canonical!, r.company_id!) : null,
    open: r.open,
    entry: r.entry,
    noExp: r.no_exp,
    training: r.training,
    aiSkill: r.ai_skill,
    aiShare: r.open ? r.ai_skill / r.open : 0,
  }
}

async function employerRows(pages: Set<string>): Promise<RankedEmployer[]> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`${ROLES_CTE}
    SELECT ${KEYED}, ${AGG}
    FROM roles r ${JOIN}
    WHERE r."companyName" IS NOT NULL AND btrim(r."companyName") <> '' AND ${NOT_STAFFING}
    GROUP BY COALESCE(r."companyId", lower(r."companyName")), r."companyId", c."canonicalNameNormalized", c.name`)
  return rows.map((r) => toRanked(r, pages))
}

/** Name variants of one employer in headlines: trailing company words dropped, known short names mapped. */
const ALIASES: Record<string, string> = { amex: 'american express' }
const GENERIC_TAIL = /\s+(bank|group|inc|corp|corporation|co|company|plc|ltd|llc|holdings|limited)\.?$/
export function layoffGroupKey(companyKey: string): string {
  let k = companyKey.toLowerCase().trim()
  for (let i = 0; i < 2; i++) k = k.replace(GENERIC_TAIL, '')
  return ALIASES[k] ?? k
}

async function aiLayoffRows(pages: Set<string>): Promise<AiLayoffEmployer[]> {
  // Only employers we have a company record for: headline-parsed names ("Kroger to", "Australian bank") never match one.
  const rows = await prisma.$queryRawUnsafe<
    { key: string; name: string; company_id: string; canonical: string; headline: string; url: string; publisher: string | null; published_at: Date | null }[]
  >(`SELECT m."companyKey" AS key, c.name, c.id AS company_id, c."canonicalNameNormalized" AS canonical, m.headline, m.url, m.publisher, m."publishedAt" AS published_at
    FROM "LayoffNewsMention" m JOIN "Company" c ON c."canonicalNameNormalized" = m."companyKey"
    WHERE m."publishedAt" > now() - interval '12 months' AND m.headline ~* '${AI_HEADLINE}' AND m.headline !~* '${AI_DENIAL}'`)
  type Row = (typeof rows)[number]
  type G = { rows: Row[]; outlets: Set<string>; latest: Row }
  const groups = new Map<string, G>()
  for (const r of rows) {
    const k = layoffGroupKey(r.key)
    const g = groups.get(k)
    if (!g) {
      groups.set(k, { rows: [r], outlets: new Set([(r.publisher ?? r.url).toLowerCase()]), latest: r })
      continue
    }
    g.rows.push(r)
    g.outlets.add((r.publisher ?? r.url).toLowerCase())
    if ((r.published_at?.getTime() ?? 0) > (g.latest.published_at?.getTime() ?? 0)) g.latest = r
  }
  // Real employers only: one with a public page (open jobs or a WARN filing), or one reported by 3+ outlets. Names parsed from headlines that
  // happen to have a company record ("AI", "Australian bank") have neither.
  return [...groups.values()]
    .filter((g) => g.outlets.size >= WIDELY_REPORTED || g.rows.some((r) => pages.has(r.company_id)))
    .map((g) => {
      // The company with the most headlines names the group; its canonical name and id make the employer-page slug.
      const counts = new Map<string, number>()
      for (const r of g.rows) counts.set(r.company_id, (counts.get(r.company_id) ?? 0) + 1)
      const top = g.rows.find((r) => r.company_id === [...counts].sort((a, b) => Number(pages.has(b[0])) - Number(pages.has(a[0])) || b[1] - a[1])[0][0])!
      return {
        name: top.name,
        slug: pages.has(top.company_id) ? employerSlug(top.canonical, top.company_id) : null,
        outlets: g.outlets.size,
        latest: { headline: g.latest.headline, url: g.latest.url, publisher: g.latest.publisher, publishedAt: g.latest.published_at ? g.latest.published_at.toISOString() : null },
      }
    })
    .sort((a, b) => b.outlets - a.outlets || (b.latest.publishedAt ?? '').localeCompare(a.latest.publishedAt ?? ''))
}

export async function buildEmployerRankings(): Promise<EmployerRankings> {
  const pages = await employerPageCompanyIds()
  const all = await employerRows(pages)
  const by = (f: (e: RankedEmployer) => number) => (a: RankedEmployer, b: RankedEmployer) => f(b) - f(a) || b.open - a.open || a.name.localeCompare(b.name)

  const aiLayoffs = await aiLayoffRows(pages)

  const aiCount = all.filter((e) => e.aiSkill > 0).sort(by((e) => e.aiSkill)).slice(0, RANK_SIZE)
  const aiShare = all
    .filter((e) => e.open >= SHARE_MIN_ROLES && e.aiSkill > 0)
    .sort((a, b) => b.aiShare - a.aiShare || b.aiSkill - a.aiSkill)
    .slice(0, RANK_SIZE)
  const layoffNames = new Set(aiLayoffs.map((l) => l.name.toLowerCase()))
  const both = [...aiCount, ...aiShare].map((e) => e.name).filter((n, i, a) => a.indexOf(n) === i && layoffNames.has(n.toLowerCase()))

  return {
    asOf: new Date().toISOString(),
    totalOpen: all.reduce((n, e) => n + e.open, 0),
    totalEntry: all.reduce((n, e) => n + e.entry, 0),
    entry: all.filter((e) => e.entry > 0).sort(by((e) => e.entry)).slice(0, RANK_SIZE),
    noExp: all.filter((e) => e.noExp > 0).sort(by((e) => e.noExp)).slice(0, RANK_SIZE),
    aiShare,
    aiCount,
    aiLayoffs: aiLayoffs.slice(0, RANK_SIZE),
    both,
  }
}

const DAY = 86_400
export const getEmployerRankings = unstable_cache(buildEmployerRankings, ['employer-rankings-v7'], { revalidate: DAY })

// ---- by function -------------------------------------------------------------------------------------------

export interface FunctionRanking {
  function: string
  open: number
  employers: RankedEmployer[]
}

export async function buildFunctionRankings(): Promise<FunctionRanking[]> {
  const pages = await employerPageCompanyIds()
  const rows = await prisma.$queryRawUnsafe<(Row & { fn: string; fn_open: number; rk: number })[]>(`${ROLES_CTE},
    per AS (
      SELECT ${KEYED}, r."targetFunction" AS fn, ${AGG}
      FROM roles r ${JOIN}
      WHERE r."targetFunction" IS NOT NULL AND r."companyName" IS NOT NULL AND btrim(r."companyName") <> '' AND ${NOT_STAFFING}
      GROUP BY COALESCE(r."companyId", lower(r."companyName")), r."companyId", c."canonicalNameNormalized", c.name, r."targetFunction"
    ),
    ranked AS (
      SELECT per.*, row_number() OVER (PARTITION BY fn ORDER BY open DESC, name) AS rk, sum(open) OVER (PARTITION BY fn)::int AS fn_open
      FROM per
    )
    SELECT * FROM ranked WHERE rk <= ${FUNCTION_RANK_SIZE} ORDER BY fn, rk`)
  const byFn = new Map<string, FunctionRanking>()
  for (const r of rows) {
    const g = byFn.get(r.fn) ?? { function: r.fn, open: r.fn_open, employers: [] }
    g.employers.push(toRanked(r, pages))
    byFn.set(r.fn, g)
  }
  const order = new Map(JOB_FUNCTIONS.map((f, i) => [f.name, i]))
  return [...byFn.values()].filter((g) => order.has(g.function)).sort((a, b) => order.get(a.function)! - order.get(b.function)!)
}

export const getFunctionRankings = unstable_cache(buildFunctionRankings, ['employer-rankings-functions-v2'], { revalidate: DAY })

export async function getFunctionRanking(fnName: string): Promise<FunctionRanking | null> {
  const all = await getFunctionRankings()
  return all.find((g) => g.function === fnName) ?? null
}
