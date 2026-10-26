import { placeStateSeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, Stat, ActionBand } from '@/components/seo/SeoPage'
import { CollegeTable, EconomySection, EmployerList, HeadquarteredList, LayoffsSection, PlaceLinks, WorkforceSection } from '@/components/places/PlaceSections'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { getPlaceLinker, getStatePage, placeUrl } from '@/lib/places/places'
import { placeJsonLd } from '@/lib/places/jsonld'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const d = await getStatePage(code)
  if (!d.area && d.counties.length === 0) return null
  return { code, name: stateName(code), d }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const s = await load(state)
  if (!s) return {}
  const { d, name } = s
  const bits = [
    d.area?.unemploymentRate != null ? `${d.area.unemploymentRate.toFixed(1)}% unemployment` : null,
    d.jobsOpen ? `${d.jobsOpen.toLocaleString()} open professional jobs` : null,
    d.layoffs.notices ? `${d.layoffs.notices} WARN layoff notices in 12 months` : null,
  ].filter(Boolean)
  return {
    title: placeStateSeo(name).title,
    description: `${name} job market by county and city: ${bits.join(', ')}. Largest employers, colleges, workforce boards and American Job Centers.`,
    ...canonical(placeUrl.state(state)),
  }
}

export default async function StatePlacePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const s = await load(state)
  if (!s) notFound()
  const { code, name, d } = s
  const linkPlace = await getPlaceLinker(code)
  const byPop = [...d.counties].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))

  return (
    <SeoPage
      trail={[{ name: 'Local job markets', path: '/places' }, { name, path: placeUrl.state(state) }]}
      h1={placeStateSeo(name).h1}
      lede={<>
        {d.area?.unemploymentRate != null && <>{name}’s unemployment rate is {d.area.unemploymentRate.toFixed(1)}%. </>}
        {d.jobsOpen > 0 && <>{d.jobsOpen.toLocaleString()} open professional jobs are listed here. </>}
        Employers filed {d.layoffs.notices.toLocaleString()} layoff notices in the last 12 months. Choose a county or city for the same picture closer to home.
      </>}
      jsonLd={[placeJsonLd({ type: 'State', name, path: placeUrl.state(state), population: d.area?.population })]}
    >
      {d.area && <EconomySection id="economy" title={`${name} economy`} labor={d.area} scope={name} />}

      <LayoffsSection id="layoffs" title={`${name} layoffs`} scope={name} stats={d.layoffs} notices={d.recentNotices}
        trackerHref={d.layoffs.notices > 0 ? `/layoffs/${state}` : null} placeHref={linkPlace} />

      <EmployerList id="hiring" title={`Employers hiring most in ${name}`} intro="Employers with the most open professional roles on our job board right now." items={d.hiring} />
      <HeadquarteredList id="largest" title={`Largest employers headquartered in ${name}`} items={d.headquartered} />

      <section aria-labelledby="highered" className="mt-12">
        <h2 id="highered" className={H2}>Higher education in {name}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat value={d.collegeCount.toLocaleString()} label="public and private nonprofit colleges" note="Source: IPEDS, U.S. Department of Education" />
          {d.area && d.area.higherEdEnrollmentEst > 0 && <Stat value={`about ${d.area.higherEdEnrollmentEst.toLocaleString()}`} label="students enrolled" note="Estimated from size bands" />}
        </ul>
      </section>
      <CollegeTable id="colleges" title={`Largest colleges in ${name}`} colleges={d.colleges}
        more={{ href: `/higher-education/${state}`, label: `All ${d.collegeCount.toLocaleString()} ${name} colleges` }} />

      <WorkforceSection id="workforce" state={name} stateSlugValue={state} boards={d.boards} centers={[]} scope={name} />
      {d.centerCount > 0 && (
        <p className="mt-4 text-sm"><Link href={`/workforce-boards/${state}`} className={LINK}>{d.centerCount.toLocaleString()} American Job Centers in {name}</Link></p>
      )}

      <PlaceLinks id="counties" title={`${name} counties`} intro="Each county page has its own unemployment, layoffs, job openings, employers, colleges and job centers."
        links={byPop.map((c) => ({ href: placeUrl.county(state, c.slug), label: c.name, note: c.unemploymentRate != null ? `${c.unemploymentRate.toFixed(1)}% unemployed` : undefined }))} />

      <PlaceLinks id="cities" title={`${name} cities`} intro="Cities with open jobs, layoff notices, a job center or a college."
        links={d.cities.map((c) => ({ href: placeUrl.city(state, c.slug), label: c.name, note: c.jobs ? `${c.jobs.toLocaleString()} jobs` : undefined }))} />

      <ActionBand
        title={`Laid off or looking for work in ${name}?`}
        body={`See what to do first, what ${name} unemployment benefits pay, and the jobs open near you.`}
        label="See your options after a layoff"
        href="/start/laid-off"
        event="place_cta_clicked"
        properties={{ level: 'state', state: code }}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> Census Bureau and BLS for population, income and unemployment; WARN notices from {name}’s published record;
        job counts from our live job board, taken from employers’ own career sites; IPEDS for colleges; CareerOneStop for workforce boards and job centers.{' '}
        <Link href={`/unemployment-benefits/${state}`} className={LINK}>{name} unemployment benefits</Link>.
      </p>
    </SeoPage>
  )
}
