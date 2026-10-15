import 'server-only'
import { prisma } from '@/lib/prisma'
import { audienceOf, meaningfulDeadline, type FundingNotice } from './relevance'
import { inStateScope, matchesOrgKinds, type ApplicantKind, type Eligibility } from './eligibility'

export { nextCloseAmong } from './eligibility'

/**
 * FundingOpportunity reads and writes, by raw SQL.
 *
 * Raw rather than the generated client so every caller can survive the table
 * not existing yet (prisma/manual/funding-opportunities.sql is applied by hand):
 * each function here throws on a missing table and callers decide what to do.
 */

export interface StoredOpportunity {
  id: string
  source: string
  title: string
  kind: string
  audience: 'CUSTOMERS' | 'US'
  eligibility: Exclude<Eligibility, 'NOT_ELIGIBLE'>
  applicantKinds: ApplicantKind[]
  partnerKinds: ApplicantKind[]
  /** Applicants restricted to these states; empty = nationwide. */
  states: string[]
  eligibilityNote: string | null
  agency: string
  orgId: string | null
  url: string
  postedAt: Date | null
  closesAt: Date | null
  awardCeiling: number | null
}

const COLUMNS = `"id","source","title","kind","audience","eligibility","applicantKinds","partnerKinds","states","eligibilityNote","agency","orgId","url","postedAt","closesAt","awardCeiling"`
const DAY = 86_400_000

export async function upsertOpportunities(rows: { notice: FundingNotice; orgId: string | null }[]): Promise<number> {
  let n = 0
  const now = new Date()
  for (const { notice: x, orgId } of rows) {
    if (x.eligibility === 'NOT_ELIGIBLE') continue
    const ext = x.externalId ?? x.id
    await prisma.$executeRaw`
      INSERT INTO "FundingOpportunity"
        ("id","source","externalId","title","kind","audience","eligibility","applicantKinds","partnerKinds","states","eligibilityNote",
         "agency","orgId","url","state","postedAt","closesAt","awardCeiling")
      VALUES (${`${x.source}:${ext}`}, ${x.source}, ${ext}, ${x.title}, ${x.kind}, ${audienceOf(x.kind)}, ${x.eligibility ?? 'UNKNOWN'},
              ${x.applicantKinds ?? []}::text[], ${x.partnerKinds ?? []}::text[], ${x.states ?? []}::text[], ${x.eligibilityNote ?? null},
              ${x.agency}, ${orgId}, ${x.url}, ${x.state}, ${x.postedAt}, ${meaningfulDeadline(x, now)}, ${x.awardCeiling ?? null})
      ON CONFLICT ("source","externalId") DO UPDATE SET
        "title" = EXCLUDED."title", "kind" = EXCLUDED."kind", "audience" = EXCLUDED."audience",
        "eligibility" = EXCLUDED."eligibility", "applicantKinds" = EXCLUDED."applicantKinds",
        "partnerKinds" = EXCLUDED."partnerKinds", "states" = EXCLUDED."states", "eligibilityNote" = EXCLUDED."eligibilityNote",
        "orgId" = COALESCE(EXCLUDED."orgId", "FundingOpportunity"."orgId"),
        "closesAt" = EXCLUDED."closesAt", "awardCeiling" = EXCLUDED."awardCeiling", "lastSeenAt" = CURRENT_TIMESTAMP`
    n++
  }
  return n
}

/** Open (not yet closed) opportunities, soonest close first. Filter in SQL only on what is cheap. */
export async function listOpenOpportunities(opts: { audience?: 'CUSTOMERS' | 'US'; eligibility?: Eligibility; limit?: number; now?: Date } = {}): Promise<StoredOpportunity[]> {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - DAY)
  const rows = await prisma.$queryRawUnsafe<StoredOpportunity[]>(
    `SELECT ${COLUMNS} FROM "FundingOpportunity"
      WHERE ("closesAt" IS NULL OR "closesAt" >= $1)
        AND ($2::text IS NULL OR "audience" = $2)
        AND ($3::text IS NULL OR "eligibility" = $3)
      ORDER BY "closesAt" ASC NULLS LAST, "postedAt" DESC NULLS LAST
      LIMIT $4`,
    cutoff, opts.audience ?? null, opts.eligibility ?? null, opts.limit ?? 200,
  )
  return rows
}

/** The open opportunities an organization of these applicant kinds could apply for, or partner on. */
export async function opportunitiesForKinds(kinds: ApplicantKind[], opts: { state?: string | null; limit?: number; now?: Date } = {}): Promise<StoredOpportunity[]> {
  if (kinds.length === 0) return []
  const all = await listOpenOpportunities({ audience: 'CUSTOMERS', now: opts.now, limit: 500 })
  return all
    .filter((o) => matchesOrgKinds({ eligibility: o.eligibility, kinds: o.applicantKinds }, kinds) && inStateScope(o.states, opts.state))
    .slice(0, opts.limit ?? 20)
}

export interface OrgOpportunityCounts {
  /** Open grants and forecasts this organization issues. */
  funding: number
  /** Open RFPs, RFIs and pre-solicitations this organization issues. */
  rfps: number
}

/**
 * Open opportunities per issuing organization, for the Organizations list.
 * Missing table (applied by hand) reads as no counts rather than an error.
 */
export async function countOpenByOrg(orgIds: string[]): Promise<Map<string, OrgOpportunityCounts>> {
  const out = new Map<string, OrgOpportunityCounts>()
  if (orgIds.length === 0) return out
  try {
    const rows = await prisma.$queryRaw<{ orgId: string; kind: string; n: number }[]>`
      SELECT "orgId", "kind", COUNT(*)::int AS n
        FROM "FundingOpportunity"
       WHERE "orgId" = ANY(${orgIds}) AND ("closesAt" IS NULL OR "closesAt" >= NOW())
       GROUP BY 1, 2`
    for (const r of rows) {
      const c = out.get(r.orgId) ?? { funding: 0, rfps: 0 }
      if (r.kind === 'GRANT' || r.kind === 'FORECAST') c.funding += r.n
      else c.rfps += r.n
      out.set(r.orgId, c)
    }
  } catch {
    // table not applied yet
  }
  return out
}
