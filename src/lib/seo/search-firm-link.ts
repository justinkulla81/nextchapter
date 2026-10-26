import { claimSlug } from '@/lib/org-claims/urls'
import { isUsableFirmSlug } from '@/lib/seo/search-firm-bar'

export const STAFFING_INDUSTRY = 'Staffing & Human Capital'

/** The organization is a search firm, recruiting firm, staffing company or outplacement firm, so it has a /search-firms page. Pure. */
export function isSearchFirmOrg(o: { orgTypes: string[]; hasSearchFirm: boolean; companyIndustry: string | null }): boolean {
  return o.hasSearchFirm || o.companyIndustry === STAFFING_INDUSTRY || o.orgTypes.includes('SEARCH_FIRM') || o.orgTypes.includes('OUTPLACEMENT_FIRM')
}

/** Path of the organization's public search-firm page (the CRM "Public page" link), or null when it has none. */
export function searchFirmPublicPath(o: { canonicalNameNormalized: string; orgTypes: string[]; hasSearchFirm: boolean; companyIndustry: string | null }): string | null {
  if (!isSearchFirmOrg(o)) return null
  const slug = claimSlug(o.canonicalNameNormalized)
  return isUsableFirmSlug(slug) ? `/search-firms/${slug}` : null
}
