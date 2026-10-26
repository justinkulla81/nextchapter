import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OrgPageView } from '@/components/seo/OrgPageView'
import { canonical } from '@/lib/seo/canonical'
import { areaHiring, claimSlugFor, getOrgPage } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'

// One page per organization, built on first visit and refreshed daily. A page below the content bar
// (src/lib/seo/org-page-rules.ts) renders but is noindex and left out of the sitemap.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

type Params = Promise<{ state: string; slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state, slug } = await params
  const p = await getOrgPage('ECON_DEV', state, slug)
  if (!p) return {}
  const { row, blocks } = p
  const st = stateName(row.state)
  return {
    title: `${row.name}, ${row.city ? row.city + ', ' : ''}${row.state}`,
    description: `${row.label} ${row.city ? 'in ' + row.city + ', ' + st : 'in ' + st}. ${blocks.jobsOpen.toLocaleString('en-US')} open professional jobs in the area it serves, ${blocks.entryLevel.toLocaleString('en-US')} entry-level, with contact details, colleges and other local help.`,
    ...canonical(`/economic-development/${state}/${slug}`),
    ...(p.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function Page({ params }: { params: Params }) {
  const { state, slug } = await params
  const p = await getOrgPage('ECON_DEV', state, slug)
  if (!p) notFound()
  const [hiring, claim] = await Promise.all([areaHiring(p.row.state, p.area), claimSlugFor('ECON_DEV', p.row.id, p.row.aliasIds)])
  return <OrgPageView page={p} path={`/economic-development/${state}/${slug}`} hiring={hiring} claimSlug={claim} />
}
