import { employerPath } from '@/lib/seo/employer-pages'
import { orgSlug } from '@/lib/crm/org-slug'

// Where a CRM organization shows up in public: its search-engine page and its claim page. Shown on the CRM
// organization page ("Public page"). Other public page families (job centers, colleges, search firms) add their
// own path here so the CRM has one place that knows every public URL for an organization.

export interface PublicPageLink { label: string; path: string }

export function publicPagesFor(org: { canonicalNameNormalized: string; company?: { id: string; canonicalNameNormalized: string } | null }): PublicPageLink[] {
  const out: PublicPageLink[] = []
  if (org.company) out.push({ label: 'Employer page (search engines)', path: employerPath(org.company.canonicalNameNormalized, org.company.id) })
  const claim = orgSlug(org.canonicalNameNormalized)
  if (claim) out.push({ label: 'Claim page', path: `/prepared/${claim}` })
  return out
}
