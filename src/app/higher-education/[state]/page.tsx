import { fitDescription, higherEdStateSeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { canonical } from '@/lib/seo/canonical'
import { collegePath } from '@/lib/seo/college-bar'
import { getStateCollegeListings } from '@/lib/seo/college-pages'
import { stateFromSlug, stateName, stateSlug } from '@/lib/seo/states'
import { getStateLabor, periodLabel, rateText } from '@/lib/seo/workforce-pages'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const colleges = await getStateCollegeListings(code)
  if (colleges.length === 0) return null
  const labor = await getStateLabor(code)
  return { code, name: stateName(code), colleges, labor }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return {}
  return {
    title: titleMeta(higherEdStateSeo(d.name).title),
    description: fitDescription(`${d.colleges.length} colleges in ${d.name} and the job market their graduates enter: unemployment, programs, outcomes and a free alumni workspace for career services.`),
    ...canonical(`/higher-education/${state}`),
  }
}

export default async function HigherEdStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) notFound()

  return (
    <SeoPage
      trail={[{ name: 'Higher education', path: '/higher-education' }, { name: d.name, path: `/higher-education/${state}` }]}
      h1={higherEdStateSeo(d.name).h1}
      lede={<>{d.colleges.length} colleges in {d.name}, and the job market their graduates enter. A career services or alumni staff member can claim their college’s page and set up a free workspace.</>}
    >
      <section aria-labelledby="market" className="mt-10">
        <h2 id="market" className={H2}>The {d.name} job market</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {d.labor && <Stat value={rateText(d.labor)} label={`unemployment, ${periodLabel(d.labor.period)}`} note="Source: BLS Local Area Unemployment Statistics, counties summed" />}
          <Stat value={d.colleges.length.toLocaleString()} label="colleges listed" note="Source: IPEDS and the College Scorecard, U.S. Department of Education" />
        </ul>
        <p className="mt-3 text-sm">
          <Link href={`/workforce-boards/${state}`} className={LINK}>{d.name} workforce boards</Link>
          {' · '}
          <Link href={`/places/${state}`} className={LINK}>{d.name} by county and city</Link>
        </p>
      </section>

      <section aria-labelledby="colleges" className="mt-12">
        <h2 id="colleges" className={H2}>Colleges in {d.name}</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Colleges in {d.name}</caption>
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr><th scope="col" className="p-3">College</th><th scope="col" className="p-3">City</th><th scope="col" className="p-3">Type</th><th scope="col" className="p-3">Students</th><th scope="col" className="p-3"><span className="sr-only">Claim</span></th></tr>
            </thead>
            <tbody>
              {d.colleges.map((c) => (
                <tr key={c.unitid} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-navy"><Link href={collegePath(state, c.slug)} className={LINK}>{c.name}</Link></td>
                  <td className="p-3">{c.city ?? ''}</td>
                  <td className="p-3">{[c.control, c.level].filter(Boolean).join(' ')}</td>
                  <td className="p-3">{c.enrollment ? c.enrollment.toLocaleString('en-US') : ''}</td>
                  <td className="p-3">
                    {c.claimSlug && (
                      <TrackedLink href={`/prepared/${c.claimSlug}`} event="seo_claim_clicked" properties={{ page: 'higher_ed_state', audience: 'higher_ed', state: d.code, collegeId: c.unitid }} className={LINK} ariaLabel={`Claim the page for ${c.name}`}>
                        Claim page
                      </TrackedLink>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ActionBand
        title={`Work in career services or alumni relations at a ${d.name} college?`}
        body="Claim your college’s page and set up a free workspace for alumni and students. Use a work email at your institution’s domain."
        label="See how a college claims its page"
        href="/higher-education#claim"
        event="seo_claim_clicked"
        properties={{ page: 'higher_ed_state', audience: 'higher_ed', state: d.code }}
      />
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> college directory from IPEDS (U.S. Department of Education), 2-year and 4-year public, private nonprofit and for-profit institutions;
        unemployment from the Bureau of Labor Statistics. <Link href={`/unemployment-benefits/${stateSlug(d.code)}`} className={LINK}>{d.name} unemployment benefits</Link>.
      </p>
    </SeoPage>
  )
}
