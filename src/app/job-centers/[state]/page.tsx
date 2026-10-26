import type { Metadata } from 'next'
import { emptyStateOrNotFound } from '@/lib/seo/empty-state'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
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
  const d = await getStateOrgList('JOB_CENTER', state)
  if (!d) return {}
  return { title: `American Job Centers in ${d.name}`, description: `${d.rows.length} American Job Centers in ${d.name}, with the area each serves, open jobs there and how to reach it.`, ...canonical(`/job-centers/${state}`) }
}

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await getStateOrgList('JOB_CENTER', state)
  if (!d) emptyStateOrNotFound(state, '/job-centers')
  const byCity = new Map<string, typeof d.rows>()
  for (const r of d.rows) (byCity.get(r.city ?? 'Statewide and regional') ?? byCity.set(r.city ?? 'Statewide and regional', []).get(r.city ?? 'Statewide and regional')!).push(r)
  return (
    <SeoPage
      trail={[{ name: 'American Job Centers', path: '/job-centers' }, { name: d.name, path: `/job-centers/${state}` }]}
      h1={`American Job Centers in ${d.name}`}
      lede={<>{d.rows.length.toLocaleString('en-US')} listed in {d.name}. Each page shows the counties it serves, the jobs open there and how to reach it.</>}
    >
      <section aria-labelledby="list" className="mt-10">
        <h2 id="list" className={H2}>All in {d.name}</h2>
        <div className="mt-4 columns-1 gap-8 text-sm sm:columns-2 lg:columns-3">
          {[...byCity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([city, rows]) => (
            <div key={city} className="mb-4 break-inside-avoid">
              <p className="font-medium text-navy">{city}</p>
              <ul className="mt-1 space-y-1">{rows.map((r) => <li key={r.id}><Link href={orgPagePath('JOB_CENTER', stateSlug(d.code), r.slug)} className={LINK}>{r.name}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </SeoPage>
  )
}
