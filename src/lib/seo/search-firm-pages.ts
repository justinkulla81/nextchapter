import { getOrgBrand } from '@/lib/branding/store'
import { fallbackPair } from '@/lib/branding/fallback'
import { buildPair, type BrandPair } from '@/lib/branding/scan'
import { tint } from '@/lib/branding/colors'
import 'server-only'
import { cache } from 'react'
import { memoTtl } from '@/lib/db/heavy'
import { persisted, storeNow } from '@/lib/seo/topic-snapshot'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withStatementTimeout } from '@/lib/db/statement-timeout'
import { isPublicJob } from '@/lib/jobs/public-job-page'
import { PUBLIC_JOB_LIST_SELECT, PUBLIC_JOB_LIVE_SQL, PUBLIC_JOB_STATIC_SQL, withDescriptionStubs } from '@/lib/jobs/public-job-page-server'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import { STAFFING_INDUSTRY, isSearchFirmOrg } from '@/lib/seo/search-firm-link'
import { resolveClaimableOrg } from '@/lib/org-claims/org'
import { claimSlug } from '@/lib/org-claims/urls'
import { isHexColor } from '@/lib/recruiter/brand'
import { NOT_RECRUITER_ORGS, NOT_RECRUITER_SOURCES, isNotRecruiterOrg, isNotRecruiterSource } from '@/lib/search-firms/not-recruiters'
import {
  SEARCH_FIRM_MIN_PUBLIC_ROLES,
  firmKind,
  industryLabel,
  isSearchFirmIndexable,
  seniorityBand,
  isUsableFirmSlug,
  summarizeSearches,
  yearlyRange,
  type FirmKind,
  type SearchRow,
  type SearchSummary,
} from '@/lib/seo/search-firm-bar'

// Public search-firm pages (/search-firms/<slug>): what a recruiting firm is searching for right now, from our own tables.
// The page is keyed on the CRM organization, so its slug is the same as the organization's claim page (/prepared/<slug>).
// A firm's searches are the live postings tied to its Company row (companyId) or crawled from its own board
// (sourceCategory 'search_firm', sourceName = its name). The client a search is run for is never shown: only the
// role, level, function, place and pay, and only for postings that already have a public job page (isPublicJob).

export { STAFFING_INDUSTRY } from '@/lib/seo/search-firm-link'
export const SEARCH_FIRM_SITEMAP_SHARD_SIZE = 10_000
const MAX_ROWS = 2000
const LISTED_ROLES = 12

export interface SearchFirmRole { id: string; title: string; location: string | null; level: string | null; pay: [number, number] | null }

export interface SearchFirmPage {
  orgId: string
  slug: string
  name: string
  website: string | null
  kind: FirmKind
  hq: string | null
  teamPageUrl: string | null
  summary: SearchSummary
  roles: SearchFirmRole[]
  lastChecked: Date | null
  indexable: boolean
  /** The firm has claimed its page and an admin verified it: its own inbound page at /in/<inboundSlug> is live. */
  inboundSlug: string | null
  /** The firm's accent color for its page: the color it set when it claimed the page, else the one read from its website. Null: NextChapter's navy. */
  accent: string | null
  /** The firm's two page colors: stored for the firm (set by hand or read from its site), else made from its accent, else one NextChapter picks so no firm page is without color. */
  brand: BrandPair
  /** What the firm's own site says about it (its meta description), or null. Shown with a link to the site. */
  about: string | null
}

function toRow(r: Prisma.ExclusiveJobPostingGetPayload<{ select: typeof SELECT }>): SearchRow {
  return {
    id: r.id, title: r.title, level: r.level, fn: r.targetFunction, industry: r.industry, location: r.location, state: r.locationState,
    workArrangement: r.workArrangement, salaryMin: r.salaryMin, salaryMax: r.salaryMax, payPeriod: r.payPeriod,
    entryPhrase: !!(r.noExperiencePhrase || r.trainingPhrase), aiSkill: r.aiSkillGroups.length > 0, openSince: r.postedAt ?? r.createdAt,
  }
}

const SELECT = { ...PUBLIC_JOB_LIST_SELECT, level: true, targetFunction: true, industry: true, aiSkillGroups: true } satisfies Prisma.ExclusiveJobPostingSelect

export const getSearchFirmBySlug = cache(async (slug: string): Promise<SearchFirmPage | null> => {
  if (!isUsableFirmSlug(slug)) return null
  const claim = await resolveClaimableOrg(slug)
  if (!claim) return null
  const org = await prisma.crmOrganization.findUnique({
    where: { id: claim.id },
    select: {
      id: true, name: true, canonicalNameNormalized: true, website: true, hqCity: true, hqRegion: true, orgTypes: true, companyId: true,
      company: { select: { industry: true } },
      // Every crawled row on the organization: a firm merged from a duplicate has two, and the postings of each are matched on its own name.
      searchFirms: { select: { name: true, segment: true, teamPageUrl: true, website: true, sourceKey: true }, orderBy: { liveSearchCount: 'desc' } },
      recruiterFirm: { select: { status: true, slug: true, accentColor: true } },
    },
  })
  if (!org) return null
  const firm = org.searchFirms[0] ?? null
  const staffing = org.company?.industry === STAFFING_INDUSTRY
  if (!isSearchFirmOrg({ orgTypes: org.orgTypes, hasSearchFirm: !!firm, companyIndustry: org.company?.industry ?? null })) return null

  const [brand, storedBrand] = await Promise.all([
    prisma.firmBrandColor.findUnique({ where: { orgId: org.id }, select: { color: true, about: true } }).catch(() => null),
    getOrgBrand('SEARCH_FIRM', org.id),
  ])
  const own = org.recruiterFirm?.accentColor
  const accent = own && isHexColor(own) ? own : (brand?.color ?? null)
  const pair: BrandPair = own && isHexColor(own) ? buildPair(own, tint(own, 0.55), true) : (storedBrand?.pair ?? (accent ? buildPair(accent, tint(accent, 0.55), true) : fallbackPair(org.id)))

  const names = [...new Set([org.name, ...org.searchFirms.map((f) => f.name)].filter((n): n is string => !!n))]
  const or: Prisma.ExclusiveJobPostingWhereInput[] = [{ sourceCategory: 'search_firm', sourceName: { in: names } }]
  if (org.companyId) or.push({ companyId: org.companyId })
  const [listed, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { status: 'approved', archivedAt: null, closeReason: null, OR: or },
      select: SELECT,
      orderBy: { lastVerifiedAt: 'desc' },
      take: MAX_ROWS,
    }),
    getConfirmedGhostIds(),
  ])
  const rows = await withDescriptionStubs(listed)
  const now = Date.now()
  const live = rows.filter((r) => isPublicJob(r, now, ghosts.has(r.id)))
  const summary = summarizeSearches(live.map(toRow), now)
  const hq = [org.hqCity, org.hqRegion].filter(Boolean).join(', ') || null
  return {
    orgId: org.id,
    slug,
    name: org.name,
    website: firm?.website ?? org.website,
    kind: firmKind({ segment: firm?.segment ?? null, staffing, orgTypes: org.orgTypes }),
    hq,
    teamPageUrl: firm?.teamPageUrl ?? null,
    summary,
    roles: live.slice(0, LISTED_ROLES).map((r) => ({
      id: r.id, title: r.title, location: r.location, level: r.level,
      pay: yearlyRange(r),
    })),
    lastChecked: live.reduce<Date | null>((m, r) => (r.lastVerifiedAt && (!m || r.lastVerifiedAt > m) ? r.lastVerifiedAt : m), null),
    indexable: isSearchFirmIndexable(summary.publicRoles) && !org.searchFirms.some((f) => isNotRecruiterSource(f.sourceKey)) && !isNotRecruiterOrg(org.canonicalNameNormalized),
    inboundSlug: org.recruiterFirm?.status === 'VERIFIED' ? (org.recruiterFirm.slug ?? null) : null,
    accent: pair.primary,
    brand: pair,
    about: brand?.about ?? null,
  }
})

// ── The list behind the sitemap, the hub, llms.txt and IndexNow ───────────────────────────────

export interface FirmListing {
  orgId: string
  slug: string
  name: string
  kind: FirmKind
  publicRoles: number
  topFunction: string | null
  states: string[]
  /** What its live searches say it recruits for. All empty means "General": the data names no specialty. */
  industries: string[]
  functions: string[]
  seniorities: string[]
  /** A recruiting firm in its own right (a SEARCH_FIRM organization or a crawled SearchFirm row), not an employer the company-industry field files under staffing. */
  recruiter: boolean
  /** Live public searches by function and level, keyed `<function>|<band>` ("Sales|C-suite"). A role page ranks firms on its own cell. */
  fnLevel: Record<string, number>
  lastVerifiedAt: Date
}

interface HitRow {
  oid: string
  canon: string
  name: string
  segment: string | null
  staffing: boolean
  recruiter: boolean
  types: string[]
  fn: string | null
  state: string | null
  industry: string | null
  level: string | null
  verified: Date
  jobId: string
}

/**
 * Every firm with at least SEARCH_FIRM_MIN_PUBLIC_ROLES public searches — the same rule as the page's `indexable`, in SQL.
 * One pass over the firms' postings (the allowlist from public-job-page-server.ts), grouped here. Cached for 6 hours.
 */
/** Searches per `<function>|<band>`, only where both are known. */
function fnLevelCounts(rows: { fn: string | null; level: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const band = seniorityBand(r.level)
    if (r.fn && band) out[`${r.fn}|${band}`] = (out[`${r.fn}|${band}`] ?? 0) + 1
  }
  return out
}

interface FirmBase { oid: string; canon: string; fname: string; fname2: string | null; cid: string | null; segment: string | null; staffing: boolean | null; recruiter: boolean; types: string[] }
interface PostingRow { jid: string; fn: string | null; state: string | null; industry: string | null; level: string | null; verified: Date }

/** Company ids per batch: 100 ids read in 0.9 s through the (companyId, lastVerifiedAt) index on 2026-11-12. */
export const FIRM_COMPANY_BATCH = 100
const FIRMS_STAGE_MS = 20_000
const SEARCH_FIRM_POSTINGS_STAGE_MS = 90_000
const COMPANY_BATCH_STAGE_MS = 30_000

/**
 * The hits (organization, posting) behind the firm list, read in three stages that each have their own time limit, instead of one query.
 * The single query ran past 120 s and was cancelled every time (11-09 to 11-12): it matched postings to firms with an OR join (a nested loop of
 * every firm against every posting) and found the search-firm postings by walking the index of all live jobs. Here:
 *   1. the firms (about 2,200 rows);
 *   2. postings crawled from a firm's own board (sourceCategory 'search_firm'): their ids first, from the partial index on sourceName
 *      (about 36,000), then the public rules by primary key (11,000 pass), matched to firms by name here;
 *   3. postings tied to a firm's Company row, 100 companies per read through the company index.
 * Any stage that fails or times out fails the whole load, so a half-built list is never stored.
 */
async function loadHitRows(): Promise<HitRow[]> {
  const firms = await withStatementTimeout(
    prisma.$queryRaw<FirmBase[]>`
      SELECT o.id AS oid, o."canonicalNameNormalized" AS canon, o.name AS fname, f.name AS fname2, o."companyId" AS cid,
             f.segment AS segment, (c.industry = ${STAFFING_INDUSTRY}) AS staffing, (f.id IS NOT NULL OR o."orgTypes" && ARRAY['SEARCH_FIRM']::"CrmOrgType"[]) AS recruiter, o."orgTypes"::text[] AS types
      FROM "CrmOrganization" o
      LEFT JOIN "SearchFirm" f ON f."crmOrgId" = o.id
      LEFT JOIN "Company" c ON c.id = o."companyId"
      WHERE (o."orgTypes" && ARRAY['SEARCH_FIRM', 'OUTPLACEMENT_FIRM']::"CrmOrgType"[] OR f.id IS NOT NULL OR c.industry = ${STAFFING_INDUSTRY})
        AND COALESCE(f."sourceKey" = ANY(${NOT_RECRUITER_SOURCES as string[]}::text[]), false) = false
        AND o."canonicalNameNormalized" <> ALL(${NOT_RECRUITER_ORGS as string[]}::text[])`,
    FIRMS_STAGE_MS,
  )
  const hit = (f: FirmBase, p: PostingRow): HitRow => ({
    oid: f.oid, canon: f.canon, name: f.fname, segment: f.segment, staffing: f.staffing ?? false, recruiter: f.recruiter, types: f.types,
    fn: p.fn, state: p.state, industry: p.industry, level: p.level, verified: p.verified, jobId: p.jid,
  })
  const out: HitRow[] = []

  // Stage 2: postings crawled from a firm's own board, matched to firms by the board's name.
  const crawled = await withStatementTimeout(
    prisma.$queryRaw<(PostingRow & { sname: string })[]>`
      WITH ids AS MATERIALIZED (
        SELECT id FROM "ExclusiveJobPosting" WHERE "sourceCategory" = 'search_firm' AND "archivedAt" IS NULL AND "sourceName" IS NOT NULL
      )
      SELECT "ExclusiveJobPosting".id AS jid, "sourceName" AS sname, "targetFunction" AS fn, "locationState" AS state, "industry" AS industry, "level"::text AS level, "lastVerifiedAt" AS verified
      FROM "ExclusiveJobPosting"
      WHERE "ExclusiveJobPosting".id IN (SELECT id FROM ids) AND "sourceCategory" = 'search_firm' AND ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}`,
    SEARCH_FIRM_POSTINGS_STAGE_MS,
  )
  const byName = new Map<string, (PostingRow & { sname: string })[]>()
  for (const r of crawled) (byName.get(r.sname) ?? byName.set(r.sname, []).get(r.sname)!).push(r)
  for (const f of firms) {
    for (const r of byName.get(f.fname) ?? []) out.push(hit(f, r))
    if (f.fname2 && f.fname2 !== f.fname) for (const r of byName.get(f.fname2) ?? []) out.push(hit(f, r))
  }

  // Stage 3: postings tied to a firm's Company row, a batch of companies at a time.
  const firmsByCompany = new Map<string, FirmBase[]>()
  for (const f of firms) if (f.cid) (firmsByCompany.get(f.cid) ?? firmsByCompany.set(f.cid, []).get(f.cid)!).push(f)
  const companyIds = [...firmsByCompany.keys()]
  for (let i = 0; i < companyIds.length; i += FIRM_COMPANY_BATCH) {
    const batch = companyIds.slice(i, i + FIRM_COMPANY_BATCH)
    const rows = await withStatementTimeout(
      prisma.$queryRaw<(PostingRow & { cid: string })[]>`
        SELECT "ExclusiveJobPosting".id AS jid, "companyId" AS cid, "targetFunction" AS fn, "locationState" AS state, "industry" AS industry, "level"::text AS level, "lastVerifiedAt" AS verified
        FROM "ExclusiveJobPosting"
        WHERE "companyId" = ANY(${batch}::text[]) AND ${PUBLIC_JOB_STATIC_SQL} AND ${PUBLIC_JOB_LIVE_SQL}`,
      COMPANY_BATCH_STAGE_MS,
    )
    for (const r of rows) for (const f of firmsByCompany.get(r.cid) ?? []) out.push(hit(f, r))
  }
  return out
}

export async function loadFirmListings(): Promise<FirmListing[]> {
  const hits = await loadHitRows()
  // An organization with two crawled rows (a firm merged from a duplicate) joins every hit once per row: one posting counts once.
  const by = new Map<string, HitRow[]>()
  const seen = new Set<string>()
  for (const h of hits) {
    const k = `${h.oid}|${h.jobId}`
    if (seen.has(k)) continue
    seen.add(k)
    ;(by.get(h.oid) ?? by.set(h.oid, []).get(h.oid)!).push(h)
  }
  const out: FirmListing[] = []
  for (const [orgId, rows] of by) {
    const publicRoles = rows.length
    if (!isSearchFirmIndexable(publicRoles)) continue
    const slug = claimSlug(rows[0].canon)
    if (!isUsableFirmSlug(slug)) continue
    const count = (pick: (r: HitRow) => string | null, take: number) => {
      const m = new Map<string, number>()
      for (const r of rows) { const v = pick(r); if (v) m.set(v, (m.get(v) ?? 0) + 1) }
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, take).map(([v]) => v)
    }
    out.push({
      orgId, slug, name: rows[0].name,
      kind: firmKind({ segment: rows[0].segment, staffing: rows[0].staffing, orgTypes: rows[0].types }),
      publicRoles,
      recruiter: rows[0].recruiter,
      topFunction: count((r) => r.fn, 1)[0] ?? null,
      states: count((r) => r.state, 5),
      industries: count((r) => industryLabel(r.industry), 3),
      functions: count((r) => r.fn, 3),
      seniorities: count((r) => seniorityBand(r.level), 3),
      fnLevel: fnLevelCounts(rows),
      lastVerifiedAt: rows.reduce((m, r) => (r.verified > m ? r.verified : m), rows[0].verified),
    })
  }
  return out.sort((a, b) => b.publicRoles - a.publicRoles || a.name.localeCompare(b.name))
}

/** The cache stores JSON, so the date comes back as an ISO string. */
export type CachedFirmListing = Omit<FirmListing, 'lastVerifiedAt'> & { lastVerifiedAt: string }

const FIRMS_KEY = 'firms:v7'
const FIRMS_MAX_AGE_MS = 24 * 3600_000
const toCached = async (): Promise<CachedFirmListing[]> => (await loadFirmListings()).map((f) => ({ ...f, lastVerifiedAt: f.lastVerifiedAt.toISOString() }))

/**
 * The firm list for the hub, the sitemap and llms.txt. Read from a stored row (TopicSnapshot); the scan runs from the
 * topic-snapshots cron and, for a stale row, after a response, never in front of a visitor. A failed scan stores nothing.
 */
export const getFirmListings: () => Promise<CachedFirmListing[]> = memoTtl(5 * 60_000, () => 'firms', () => persisted(FIRMS_KEY, FIRMS_MAX_AGE_MS, toCached))

/** Cron entry: recompute the stored list when it is more than a day old (or missing). */
export async function refreshFirmListings(): Promise<boolean> {
  const row = await prisma.topicSnapshot.findUnique({ where: { key: FIRMS_KEY }, select: { updatedAt: true } }).catch(() => null)
  if (row && Date.now() - row.updatedAt.getTime() < FIRMS_MAX_AGE_MS) return false
  await storeNow(FIRMS_KEY, toCached)
  return true
}

export async function countSearchFirmPages(): Promise<number> {
  return (await getFirmListings()).length
}

export async function searchFirmsInShard(shard: number): Promise<{ slug: string; lastModified: Date }[]> {
  const all = await getFirmListings()
  return all.slice(shard * SEARCH_FIRM_SITEMAP_SHARD_SIZE, (shard + 1) * SEARCH_FIRM_SITEMAP_SHARD_SIZE).map((f) => ({ slug: f.slug, lastModified: new Date(f.lastVerifiedAt) }))
}

export { SEARCH_FIRM_MIN_PUBLIC_ROLES }

/** A firm with no industry and no function in its searches is "General": it is listed, but never ahead of a specialist. */
export const isGeneralFirm = (f: Pick<FirmListing, 'industries' | 'functions'>): boolean => f.industries.length === 0 && f.functions.length === 0

// ── Helpers for a member's interest in a firm (src/lib/recruiter-interest) ─────────────────────
// They live here so the member-facing code never reads a CRM table itself: this file is the one reviewed reader, and
// what leaves it is a firm's public name, page address and whether it has joined. Nothing about a CRM person or note.

export interface FirmBrief { orgId: string; name: string; slug: string | null; joined: boolean }

export async function getFirmBriefs(orgIds: string[]): Promise<Map<string, FirmBrief>> {
  if (orgIds.length === 0) return new Map()
  const rows = await prisma.crmOrganization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, canonicalNameNormalized: true, recruiterFirm: { select: { status: true } } },
  })
  return new Map(rows.map((r) => {
    const slug = claimSlug(r.canonicalNameNormalized ?? '')
    return [r.id, { orgId: r.id, name: r.name, slug: isUsableFirmSlug(slug) ? slug : null, joined: r.recruiterFirm?.status === 'VERIFIED' }]
  }))
}

/** The firm's name when the id is a real organization, else null. */
export async function firmNameOf(orgId: string): Promise<string | null> {
  return (await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { name: true } }))?.name ?? null
}

/** The joined, verified firm behind an organization (the workspace that can receive a résumé), or null. */
export async function verifiedRecruiterFirmForOrg(orgId: string) {
  const org = await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { recruiterFirm: true } })
  return org?.recruiterFirm?.status === 'VERIFIED' ? org.recruiterFirm : null
}

export async function recruiterFirmIdForOrg(orgId: string): Promise<string | null> {
  return (await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { recruiterFirmId: true } }))?.recruiterFirmId ?? null
}
