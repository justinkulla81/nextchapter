import { workforceStateSeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName, stateSlug } from '@/lib/seo/states'
import { getStateBoards, getStateCenters, getStateColleges, getStateLabor, getStateLayoffs, periodLabel, rateText } from '@/lib/seo/workforce-pages'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const boards = await getStateBoards(code)
  if (boards.length === 0) return null
  const [centers, labor, layoffs, colleges] = await Promise.all([getStateCenters(code), getStateLabor(code), getStateLayoffs(code), getStateColleges(code)])
  return { code, name: stateName(code), boards, centers, labor, layoffs, collegeCount: colleges.length }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return {}
  return {
    title: workforceStateSeo(d.name).title,
    description: `${d.boards.length} workforce ${d.boards.length === 1 ? 'board' : 'boards'} and ${d.centers.length} American Job ${d.centers.length === 1 ? 'Center' : 'Centers'} in ${d.name}: the areas each serves, local unemployment, colleges and recent layoff notices.`,
    ...canonical(`/workforce-boards/${state}`),
  }
}

export default async function WorkforceStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) notFound()

  return (
    <SeoPage
      trail={[{ name: 'Workforce boards', path: '/workforce-boards' }, { name: d.name, path: `/workforce-boards/${state}` }]}
      h1={workforceStateSeo(d.name).h1}
      lede={<>{d.name} has {d.boards.length} workforce {d.boards.length === 1 ? 'board' : 'boards'} and {d.centers.length} American Job {d.centers.length === 1 ? 'Center' : 'Centers'}. Job seekers get free help with search, training and benefits there; employers get hiring and layoff support.</>}
    >
      <section aria-labelledby="picture" className="mt-10">
        <h2 id="picture" className={H2}>{d.name} at a glance</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.labor && <Stat value={rateText(d.labor)} label={`unemployment, ${periodLabel(d.labor.period)}`} note="Source: BLS Local Area Unemployment Statistics, counties summed" />}
          <Stat value={d.layoffs.notices.toLocaleString()} label="WARN layoff notices, last 12 months" note={d.layoffs.workers > 0 ? `naming ${d.layoffs.workers.toLocaleString()} workers` : undefined} />
          <Stat value={d.centers.length.toLocaleString()} label="American Job Centers" />
          {d.collegeCount > 0 && <Stat value={d.collegeCount.toLocaleString()} label="colleges in the IPEDS directory" note="public and private nonprofit" />}
        </ul>
        {d.layoffs.notices > 0 && (
          <p className="mt-3 text-sm"><Link href={`/layoffs/${state}`} className={LINK}>See every {d.name} layoff notice</Link></p>
        )}
      </section>

      <section aria-labelledby="boards" className="mt-12">
        <h2 id="boards" className={H2}>Workforce boards</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {d.boards.map((b) => (
            <li key={b.id} className="rounded-xl border border-border bg-white p-4 text-sm">
              <Link href={`/workforce-boards/${state}/${b.slug}`} className={`${LINK} font-medium`}>{b.name}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{b.statewide ? `Statewide` : b.serviceArea ?? ''}</p>
            </li>
          ))}
        </ul>
      </section>

      {d.centers.length > 0 && (
        <section aria-labelledby="centers" className="mt-12">
          <h2 id="centers" className={H2}>American Job Centers</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">American Job Centers in {d.name}</caption>
              <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                <tr><th scope="col" className="p-3">Center</th><th scope="col" className="p-3">City</th><th scope="col" className="p-3">Type</th><th scope="col" className="p-3">Phone</th></tr>
              </thead>
              <tbody>
                {d.centers.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium text-navy">{c.name}</td><td className="p-3">{c.city ?? ''}</td><td className="p-3">{c.kind ?? ''}</td><td className="p-3">{c.phone ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ActionBand
        title={`Run a workforce board in ${d.name}?`}
        body="Claim your board’s page and set up a free workspace. Use a work email at your organization’s domain."
        label="See how a board claims its page"
        href="/government-workforce#claim"
        event="seo_claim_clicked"
        properties={{ page: 'workforce_state', audience: 'workforce', state: d.code }}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> board and job center listings from CareerOneStop (U.S. Department of Labor); unemployment from the Bureau of Labor Statistics;
        layoff notices from {d.name}’s published WARN record. <Link href={`/places/${state}`} className={LINK}>{d.name} by county and city</Link>. For employers: <Link href={`/rapid-response/${stateSlug(d.code)}`} className={LINK}>rapid response and layoff support in {d.name}</Link>.
      </p>
    </SeoPage>
  )
}
