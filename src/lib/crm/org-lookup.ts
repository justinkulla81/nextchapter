import 'server-only'
import { prisma } from '@/lib/prisma'
import { strictOrgKey } from '@/lib/crm/normalize'
import { normalizeOrgName } from '@/lib/text/org-name-match'

export type OrgMatch = { id: string; name: string; orgTypes: string[]; goals: string[] }

/**
 * The organization whose strict name key (strictOrgKey) equals `name`'s, or null; the oldest when several share it.
 *
 * Callers used to read every organization (~107k rows, id, name, types and goals) to find one, on every layoff promoted and every lead
 * imported (2026-11-17 egress alert, ~1.3M rows in six hours). The strict key is the normalized name with a trailing bracket and legal
 * suffixes dropped, so it is a prefix of the stored canonicalNameNormalized (normalizeOrgName(name)): checked on a 3,000-row sample of
 * production, every one. The database returns only the organizations whose normalized name starts with the key, and the exact key is
 * compared here. Index: prisma/manual/2026-11-17-crm-org-canonical-prefix-idx.sql.
 */
export async function findOrgByStrictKey(name: string): Promise<OrgMatch | null> {
  const key = strictOrgKey(name, normalizeOrgName)
  if (!key) return null
  const rows = await prisma.crmOrganization.findMany({
    where: { canonicalNameNormalized: { startsWith: key } },
    select: { id: true, name: true, orgTypes: true, goals: true },
    orderBy: { createdAt: 'asc' },
    take: 2_000,
  })
  return rows.find((o) => strictOrgKey(o.name, normalizeOrgName) === key) ?? null
}
