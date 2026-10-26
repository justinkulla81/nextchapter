import { placeCountySeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, LINK, ActionBand } from '@/components/seo/SeoPage'
import { CollegeTable, EconomySection, EmployerList, HeadquarteredList, LayoffsSection, PlaceLinks, WorkforceSection } from '@/components/places/PlaceSections'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { getCountyPage, getPlaceLinker, placeUrl } from '@/lib/places/places'
import { placeJsonLd } from '@/lib/places/jsonld'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(stateSlug: string, countySlug: string) {
  const code = stateFromSlug(stateSlug)
  if (!code) return null
  const d = await getCountyPage(code, countySlug)
  return d ? { code, name: stateName(code), d } : null
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; county: string }> }): Promise<Metadata> {
  const { state, county } = await params
  const s = await load(state, county)
  if (!s) return {}
  const { d, name } = s
  const c = d.county
  const bits = [
    c.unemploymentRate != null ? `${c.unemploymentRate.toFixed(1)}% unemployment` : null,
    d.jobsOpen ? `${d.jobsOpen.toLocaleString()} open jobs` : null,
    d.layoffs.notices ? `${d.layoffs.notices} layoff notices in 12 months` : null,
  ].filter(Boolean)
  return {
    title: placeCountySeo(c.name, s.code).title,
    description: `${c.name}, ${name}: ${bits.length ? bits.join(', ') + '. ' : ''}Employers, colleges, the local workforce board and American Job Centers.`,
    ...canonical(placeUrl.county(state, county)),
  }
}

export default async function CountyPlacePage({ params }: { params: Promise<{ state: string; county: string }> }) {
  const { state, county } = await params
  const s = await load(state, county)
  if (!s) notFound()
  const { code, name, d } = s
  const c = d.county
  const linkPlace = await getPlaceLinker(code)
  const path = placeUrl.county(state, county)

  return (
    <SeoPage
      trail={[{ name: 'Local job markets', path: '/places' }, { name, path: placeUrl.state(state) }, { name: c.name, path }]}
      h1={placeCountySeo(c.name, s.code).h1}
      lede={<>
        {c.unemploymentRate != null && <>{c.name}’s unemployment rate is {c.unemploymentRate.toFixed(1)}%. </>}
        {d.layoffs.notices > 0 ? <>Employers filed {d.layoffs.notices.toLocaleString()} layoff notices here in the last 12 months. </> : <>No WARN layoff notices here in the last 12 months. </>}
        {d.jobsOpen > 0 && <>{d.jobsOpen.toLocaleString()} open professional jobs are in its cities. </>}
      </>}
      jsonLd={[placeJsonLd({ type: 'AdministrativeArea', name: `${c.name}, ${name}`, path, population: c.population, containedIn: { name, path: placeUrl.state(state), type: 'State' } })]}
    >
      <EconomySection id="economy" title={`${c.name} economy`} labor={c} scope={c.name} />

      <LayoffsSection id="layoffs" title={`${c.name} layoffs`} scope={c.name} stats={d.layoffs} notices={d.notices}
        trackerHref={`/layoffs/${state}`} placeHref={linkPlace} />

      <EmployerList id="hiring" title={`Employers hiring most in ${c.name}`}
        intro="Employers with the most open professional roles in this county’s cities. The county is taken from each job’s city, so roles with no city are not counted."
        items={d.hiring} />
      <HeadquarteredList id="largest" title={`Largest employers headquartered in ${c.name}`} items={d.headquartered} />

      <CollegeTable id="colleges" title={`Colleges in ${c.name}`} colleges={d.colleges} />

      <WorkforceSection id="workforce" state={name} stateSlugValue={state} boards={d.boards} centers={d.centers} scope={c.name} />

      <PlaceLinks id="cities" title={`Cities in ${c.name}`} links={d.cities.map((x) => ({ href: placeUrl.city(state, x.slug), label: x.name, note: x.jobs ? `${x.jobs.toLocaleString()} jobs` : undefined }))} />

      <PlaceLinks id="neighbors" title={`Other ${name} counties`}
        links={d.neighbors.map((x) => ({ href: placeUrl.county(state, x.slug), label: x.name }))} />
      <p className="mt-4 text-sm"><Link href={placeUrl.state(state)} className={LINK}>All of {name}</Link></p>

      <ActionBand
        title={`Laid off or looking for work in ${c.name}?`}
        body={`See what to do first and the jobs open near you.`}
        label="See your options after a layoff"
        href="/start/laid-off"
        event="place_cta_clicked"
        properties={{ level: 'county', state: code, county: c.slug, fips: c.fips }}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> Census Bureau and BLS (county unemployment is not seasonally adjusted); WARN notices from {name}’s published record;
        job counts from our live job board; IPEDS for colleges; CareerOneStop for workforce boards and job centers.
      </p>
    </SeoPage>
  )
}
