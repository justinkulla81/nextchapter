import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface OrgLayoffs {
  /** WARN filings and announcements for this organization (its company record, or a lead made from the notice). */
  notices: number
  /** Employees named across those notices; filings without a headcount add nothing. */
  employees: number
  latest: Date | null
  /** News headlines about layoffs there. */
  news: number
}

/**
 * Layoff activity for the organizations on one page of the list. A notice counts
 * for an organization when it is matched to the organization's company record or
 * was promoted into it as a lead; news counts by the normalized company name.
 */
export async function layoffsByOrg(orgIds: string[]): Promise<Map<string, OrgLayoffs>> {
  const out = new Map<string, OrgLayoffs>()
  if (orgIds.length === 0) return out
  const [warn, news] = await Promise.all([
    prisma.$queryRaw<{ id: string; notices: number; employees: number; latest: Date | null }[]>(Prisma.sql`
      SELECT o.id, count(w.id)::int AS notices, coalesce(sum(w.employees), 0)::int AS employees,
             max(coalesce(w."noticeDate", w."effectiveDate")) AS latest
        FROM "CrmOrganization" o
        JOIN "WarnNotice" w ON w."promotedOrgId" = o.id OR (o."companyId" IS NOT NULL AND w."companyId" = o."companyId")
       WHERE o.id = ANY(${orgIds}::text[])
       GROUP BY o.id`),
    prisma.$queryRaw<{ id: string; news: number }[]>(Prisma.sql`
      SELECT o.id, count(n.id)::int AS news
        FROM "CrmOrganization" o
        JOIN "LayoffNewsMention" n ON n."companyKey" = o."canonicalNameNormalized"
       WHERE o.id = ANY(${orgIds}::text[])
       GROUP BY o.id`).catch(() => []),
  ])
  for (const r of warn) out.set(r.id, { notices: r.notices, employees: r.employees, latest: r.latest, news: 0 })
  for (const r of news) out.set(r.id, { ...(out.get(r.id) ?? { notices: 0, employees: 0, latest: null }), news: r.news })
  return out
}

/** Ids of every organization with at least one layoff notice or news mention, for the "has layoffs" filter. */
export async function orgIdsWithLayoffs(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT o.id FROM "CrmOrganization" o
     WHERE EXISTS (SELECT 1 FROM "WarnNotice" w WHERE w."promotedOrgId" = o.id OR (o."companyId" IS NOT NULL AND w."companyId" = o."companyId"))
        OR EXISTS (SELECT 1 FROM "LayoffNewsMention" n WHERE n."companyKey" = o."canonicalNameNormalized")`)
  return rows.map((r) => r.id)
}
