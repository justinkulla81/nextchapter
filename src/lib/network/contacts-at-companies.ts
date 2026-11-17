import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'

/**
 * Ids of a member's contacts whose company (or inferred company) matches one of `companies`, decided in the database with the same
 * rules as the TypeScript: `strict` is normalizeOrgName equality, otherwise orgNamesMatch (prisma/manual/2026-11-17-org-norm-sql.sql).
 * The normalized names are stored columns (companyNorm, inferredCompanyNorm): normalizing on the fly took 34 s for a ~27k-contact list,
 * the stored columns ~0.1 s.
 * Pages used to read every contact (one member has ~20k) to match a few employers (2026-11-17 egress alert). Callers still apply their
 * own match to the rows they then read, so this only has to return a superset, and it returns exactly the matches.
 */
export async function contactIdsAtCompanies(
  candidateId: string,
  companies: (string | null | undefined)[],
  opts: { strict: boolean; activeWithTitle?: boolean }
): Promise<string[]> {
  const keys = [...new Set(companies.filter((c): c is string => !!c).map(normalizeOrgName).filter(Boolean))]
  if (keys.length === 0) return []
  const extra = opts.activeWithTitle ? Prisma.sql`AND "removedAt" IS NULL AND title IS NOT NULL` : Prisma.empty
  const match = opts.strict
    ? Prisma.sql`("companyNorm" = ANY(${keys}::text[]) OR "inferredCompanyNorm" = ANY(${keys}::text[]))`
    : Prisma.sql`EXISTS (SELECT 1 FROM unnest(${keys}::text[]) k WHERE nc_org_norms_match("companyNorm", k) OR nc_org_norms_match("inferredCompanyNorm", k))`
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "SupportNetworkContact"
    WHERE "candidateId" = ${candidateId} AND (company IS NOT NULL OR "inferredCompany" IS NOT NULL) ${extra} AND ${match}`
  return rows.map((r) => r.id)
}
