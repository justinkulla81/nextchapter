import 'server-only'
import { prisma } from '@/lib/prisma'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { getStateData } from '@/lib/seo/org-pages'
import { crmOrgName, orgPagePath, type OrgPageKind } from '@/lib/seo/org-page-rules'

/**
 * The public page for a CRM organization, if one of the American Job Center / economic development / workforce board
 * pages is linked to it (PublicOrgPage). Null when none, or while the link table has not been applied yet.
 */
export async function publicPageForCrmOrg(crmOrgId: string): Promise<{ path: string; name: string } | null> {
  try {
    const link = await prisma.publicOrgPage.findFirst({ where: { crmOrgId, matchStatus: { in: ['LINKED', 'CREATED'] } }, select: { kind: true, sourceId: true, state: true } })
    if (!link || !ALL_STATE_CODES.includes(link.state)) return null
    const sd = await getStateData(link.state)
    const rows = link.kind === 'JOB_CENTER' ? sd.centers : link.kind === 'ECON_DEV' ? sd.econDev : sd.boards
    const row = rows.find((r) => r.id === link.sourceId)
    return row ? { path: orgPagePath(link.kind as OrgPageKind, stateSlug(link.state), row.slug), name: row.name } : null
  } catch {
    return null
  }
}

/** The source row behind a PublicOrgPage link, with the name the CRM should store it under. */
export async function sourceRowFor(kind: string, state: string, sourceId: string) {
  const sd = await getStateData(state)
  const rows = kind === 'JOB_CENTER' ? sd.centers : kind === 'ECON_DEV' ? sd.econDev : sd.boards
  const row = rows.find((r) => r.id === sourceId)
  if (!row) return null
  const sameNameInState = rows.filter((r) => r.name.toLowerCase() === row.name.toLowerCase()).length > 1
  return { row, crmName: crmOrgName(row, { sameNameInState }) }
}

/** Link rows waiting on the Review List, with what they are and the organization they might be. Empty before the table exists. */
export async function publicPageReviews() {
  try {
    const links = await prisma.publicOrgPage.findMany({ where: { matchStatus: 'REVIEW' }, orderBy: [{ state: 'asc' }, { sourceId: 'asc' }], take: 200 })
    const orgs = await prisma.crmOrganization.findMany({ where: { id: { in: links.map((l) => l.reviewOrgId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })
    const orgName = new Map(orgs.map((o) => [o.id, o.name]))
    const out = []
    for (const l of links) {
      const src = await sourceRowFor(l.kind, l.state, l.sourceId)
      if (src && l.reviewOrgId) out.push({ kind: l.kind, sourceId: l.sourceId, state: l.state, name: src.crmName, orgId: l.reviewOrgId, orgName: orgName.get(l.reviewOrgId) ?? 'an organization', reason: l.reviewReason })
    }
    return out
  } catch {
    return []
  }
}
