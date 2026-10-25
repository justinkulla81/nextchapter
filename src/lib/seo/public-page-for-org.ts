import 'server-only'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/seo/facts'
import { employerSlug } from '@/lib/seo/employer-slug'
import { stateSlug } from '@/lib/seo/states'
import { STATE_NAMES } from '@/lib/workforce/places'
import { getStateBoards } from '@/lib/seo/workforce-pages'
import { NONPROFIT_MIN_REVENUE, nonprofitSlug } from '@/lib/seo/nonprofit-pages'
import { EMPLOYER_MIN_OPEN_ROLES } from '@/lib/seo/employer-pages'

// The public page a CRM organization has on launchyournextchapter.com, for the "Public page" link on its CRM
// record: the employer page, the workforce board page, the college's state page, the nonprofit page or the
// state's economic development page. Null when the organization has none. Admin-only: nothing here is shown
// to candidates.

export interface PublicPageLink { url: string; label: string; indexed: boolean }

interface OrgRef { id: string; name: string; canonicalNameNormalized: string; orgTypes: string[]; companyId: string | null; usState: string | null }

const cleanPartner = (n: string) => n.replace(/\s*\((listed by[^)]*|[A-Z]{2} DLG\/[^)]*)\)\s*$/i, '').trim().toLowerCase()
const link = (path: string, label: string, indexed = true): PublicPageLink => ({ url: `${SITE_URL}${path}`, label, indexed })

export async function publicPageForOrg(org: OrgRef): Promise<PublicPageLink | null> {
  // Employer: its page exists when it has any hiring profile or layoff record; it is indexed past the bar.
  if (org.companyId) {
    const c = await prisma.company.findUnique({
      where: { id: org.companyId },
      select: { id: true, canonicalNameNormalized: true, hiringProfile: { select: { openNow: true } }, _count: { select: { warnNotices: { where: { dismissedAt: null, source: 'WARN_FILING' } } } } },
    })
    if (c && (c.hiringProfile || c._count.warnNotices > 0)) {
      const open = c.hiringProfile?.openNow ?? 0
      return link(`/employers/${employerSlug(c.canonicalNameNormalized, c.id)}`, 'Employer page', open >= EMPLOYER_MIN_OPEN_ROLES || c._count.warnNotices > 0)
    }
  }

  if (org.orgTypes.includes('UNIVERSITY')) {
    const col = await prisma.localCollege.findFirst({ where: { crmOrgId: org.id }, select: { state: true, sector: true } })
    if (col && col.state in STATE_NAMES && [1, 2, 4, 5].includes(col.sector ?? 0)) return link(`/higher-education/${stateSlug(col.state)}`, 'College listing')
  }

  if (org.orgTypes.includes('NONPROFIT') || org.orgTypes.includes('GOVERNMENT') || org.orgTypes.includes('OTHER')) {
    const np = await prisma.geoOrgLead.findFirst({ where: { crmOrganizationId: org.id }, select: { ein: true, name: true, state: true, revenue: true } })
    if (np && np.state in STATE_NAMES) {
      const big = (np.revenue ?? 0) >= NONPROFIT_MIN_REVENUE
      return big ? link(`/nonprofits/${stateSlug(np.state)}/${nonprofitSlug(np.name, np.ein)}`, 'Nonprofit page') : link(`/nonprofits/${stateSlug(np.state)}`, 'Nonprofit state listing')
    }
  }

  if (org.orgTypes.includes('GOVERNMENT')) {
    const board = await prisma.workforceBoard.findFirst({ where: { name: { equals: org.name, mode: 'insensitive' } }, select: { id: true, state: true } })
    if (board && board.state in STATE_NAMES) {
      const boards = await getStateBoards(board.state)
      const hit = boards.find((b) => b.id === board.id)
      if (hit) return link(`/workforce-boards/${stateSlug(board.state)}/${hit.slug}`, 'Workforce board page')
    }
    const center = await prisma.americanJobCenter.findFirst({ where: { name: { equals: org.name.replace(/\s*\([A-Z]{2}\)$/, ''), mode: 'insensitive' }, ...(org.usState ? { state: org.usState } : {}) }, select: { state: true, workforceBoardId: true } })
    if (center && center.state in STATE_NAMES) {
      const boards = await getStateBoards(center.state)
      const hit = boards.find((b) => b.id === center.workforceBoardId)
      return hit ? link(`/workforce-boards/${stateSlug(center.state)}/${hit.slug}`, 'Workforce board page (this job center)') : link(`/workforce-boards/${stateSlug(center.state)}`, 'Workforce boards in the state')
    }
    if (org.usState && org.usState in STATE_NAMES) {
      const partner = await prisma.localPartnerOrg.findMany({ where: { state: org.usState }, select: { name: true } })
      if (partner.some((p) => cleanPartner(p.name) === org.name.trim().toLowerCase())) return link(`/economic-development/${stateSlug(org.usState)}`, 'Economic development listing')
    }
  }
  return null
}
