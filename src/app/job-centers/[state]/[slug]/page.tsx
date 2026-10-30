import type { Metadata } from 'next'
import { getOrgBrand } from '@/lib/branding/store'
import { notFound, permanentRedirect } from 'next/navigation'
import { eventsForEmployerNames } from '@/lib/events/sec-events'
import { noticesForOrgPage } from '@/lib/seo/org-notices'
import { OrgPageView } from '@/components/seo/OrgPageView'
import { canonical } from '@/lib/seo/canonical'
import { areaHiring, claimSlugFor, getOrgPage, renamedOrgSlug } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'
import { orgPageTitle } from '@/lib/seo/org-page-rules'
import { titleMeta } from '@/lib/seo/title'

// One page per organization, built on first visit and refreshed daily. A page below the content bar
// (src/lib/seo/org-page-rules.ts) renders but is noindex and left out of the sitemap.
export const revalidate = 604800 // 7 days: slow-changing page, one of the larger ISR write sources
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

type Params = Promise<{ state: string; slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state, slug } = await params
  const p = await getOrgPage('JOB_CENTER', state, slug)
  if (!p) return {}
  const { row, blocks } = p
  const st = stateName(row.state)
  return {
    title: titleMeta(orgPageTitle(row)),
    description: `${row.label} ${row.city ? 'in ' + row.city + ', ' + st : 'in ' + st}. ${blocks.jobsOpen.toLocaleString('en-US')} open professional jobs in the area it serves, ${blocks.entryLevel.toLocaleString('en-US')} entry-level, with contact details, colleges and other local help.`,
    ...canonical(`/job-centers/${state}/${slug}`),
    ...(p.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function Page({ params }: { params: Params }) {
  const { state, slug } = await params
  const p = await getOrgPage('JOB_CENTER', state, slug)
  if (!p) {
    // The address was an organization's old slug (records merged since): send it to the current page.
    const current = await renamedOrgSlug('JOB_CENTER', state, slug)
    if (current) permanentRedirect(`/job-centers/${state}/${current}`)
    notFound()
  }
  const [hiring, claim, notices, brand] = await Promise.all([areaHiring(p.row.state, p.area), claimSlugFor('JOB_CENTER', p.row.id), noticesForOrgPage(p), getOrgBrand('JOB_CENTER', p.row.id)])
  const events = await eventsForEmployerNames(hiring.employers.map((e) => e.name)).catch(() => [])
  return <OrgPageView page={p} path={`/job-centers/${state}/${slug}`} hiring={hiring} claimSlug={claim} notices={notices} events={events} brand={brand?.pair ?? null} />
}
