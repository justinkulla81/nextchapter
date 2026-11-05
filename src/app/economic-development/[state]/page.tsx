import type { Metadata } from 'next'
import { GroupedLinkIndex } from '@/components/seo/LinkIndex'
import { emptyStateOrNotFound } from '@/lib/seo/empty-state'
import { statePhrase } from '@/lib/branding/state-colors'
import { SeoPage, H2 } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { getStateOrgList } from '@/lib/seo/org-pages'
import { orgPagePath } from '@/lib/seo/org-page-rules'
import { stateSlug } from '@/lib/seo/states'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await getStateOrgList('ECON_DEV', state)
  if (!d) return {}
  return { title: `Economic development organizations in ${d.name}`, description: `${d.rows.length} Economic development organizations in ${d.name}, with the area each serves, open jobs there and how to reach it.`, ...canonical(`/economic-development/${state}`) }
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await getStateOrgList('ECON_DEV', state)
  if (!d) emptyStateOrNotFound(state, '/economic-development')
  const byCity = new Map<string, typeof d.rows>()
  for (const r of d.rows) (byCity.get(r.city ?? 'Statewide and regional') ?? byCity.set(r.city ?? 'Statewide and regional', []).get(r.city ?? 'Statewide and regional')!).push(r)
  return (
    <SeoPage
      boxFirst
      look="audience"
      trail={[{ name: 'Economic development organizations', path: '/economic-development' }, { name: d.name, path: `/economic-development/${state}` }]}
      h1={`Economic development organizations in ${d.name}`}
      lede={<>{d.rows.length.toLocaleString('en-US')} listed in {d.name}. Each page shows the counties it serves, the jobs open there and how to reach it.</>}
    >
      <p className="mt-3 text-xs text-muted-foreground">Independent page. Not from or affiliated with {statePhrase(d.code)}.</p>
      <section aria-labelledby="list" className="mt-10">
        <h2 id="list" className={H2}>All in {d.name}</h2>
        <GroupedLinkIndex label="All in {d.name}" groups={[...byCity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([city, rows]) => ({ heading: city, items: rows.map((r) => ({ href: orgPagePath('ECON_DEV', stateSlug(d.code), r.slug), label: r.name })) }))} />
      </section>
    </SeoPage>
  )
}
