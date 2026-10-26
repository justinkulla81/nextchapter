import { publicPageForOrg } from '@/lib/seo/college-pages'
import { SITE_URL } from '@/lib/seo/facts'

/** "Public page" link for a CRM organization that is a college: the page search engines and visitors see. */
export async function CrmCollegePublicLink({ org }: { org: { id: string; name: string; usState: string | null; orgTypes: string[] } }) {
  if (!org.orgTypes.includes('UNIVERSITY')) return null
  const page = await publicPageForOrg(org).catch(() => null)
  if (!page) return null
  return (
    <p className="mt-2 text-sm">
      <span className="text-muted-foreground">Public page: </span>
      <a href={`${SITE_URL}${page.path}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{SITE_URL}{page.path}</a>
      {!page.indexable && <span className="text-muted-foreground"> (not yet in search: too little data)</span>}
    </p>
  )
}
