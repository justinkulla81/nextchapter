import { placeCitySeo } from '@/lib/seo/templates'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, LINK, ActionBand } from '@/components/seo/SeoPage'
import { CollegeTable, EconomySection, EmployerList, HeadquarteredList, JobList, LayoffsSection, PlaceLinks, WorkforceSection } from '@/components/places/PlaceSections'
import { ConferenceSection } from '@/components/events/ConferenceSection'
import { LocalEventSection } from '@/components/events/LocalEventSection'
import { conferencesAtPlace } from '@/lib/events/conference-places'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { hasLayoffStatePage } from '@/lib/warn/layoff-pages'
import { getCityPage, placeUrl } from '@/lib/places/places'
import { placeJsonLd } from '@/lib/places/jsonld'
import { titleMeta } from '@/lib/seo/title'
import { SaveSearchForm } from '@/components/home/SaveSearchForm'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(stateSlug: string, citySlug: string) {
  const code = stateFromSlug(stateSlug)
  if (!code) return null
  const d = await getCityPage(code, citySlug)
  return d ? { code, name: stateName(code), d } : null
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; city: string }> }): Promise<Metadata> {
  const { state, city } = await params
  const s = await load(state, city)
  if (!s) return {}
  const { d, code } = s
  const bits = [
    d.jobsOpen ? `${d.jobsOpen.toLocaleString()} open jobs` : null,
    d.layoffs.notices ? `${d.layoffs.notices} layoff notices in 12 months` : null,
    d.colleges.length ? `${d.colleges.length} ${d.colleges.length === 1 ? 'college' : 'colleges'}` : null,
  ].filter(Boolean)
  return {
    title: titleMeta(placeCitySeo(d.place.name, code).title),
    description: `${d.place.name}, ${s.name}: ${bits.length ? bits.join(', ') + '. ' : ''}Employers hiring, the local workforce board and American Job Centers.`,
    ...canonical(placeUrl.city(state, city)),
  }
}

export default async function CityPlacePage({ params }: { params: Promise<{ state: string; city: string }> }) {
  const { state, city } = await params
  const s = await load(state, city)
  if (!s) notFound()
  const { code, name, d } = s
  const p = d.place
  const path = placeUrl.city(state, city)
  const trail = [{ name: 'Local job markets', path: '/places' }, { name, path: placeUrl.state(state) }]
  if (d.county) trail.push({ name: d.county.name, path: placeUrl.county(state, d.county.slug) })
  trail.push({ name: p.name, path })

  return (
    <SeoPage
      stateSlug={state}
      trail={trail}
      h1={placeCitySeo(p.name, code).h1}
      lede={<>
        {d.jobsOpen > 0 && <>{d.jobsOpen.toLocaleString()} open professional jobs in {p.name}. </>}
        {d.layoffs.notices > 0 && <>Employers filed {d.layoffs.notices.toLocaleString()} layoff notices here in the last 12 months. </>}
        {d.county && <>{p.name} is in <Link href={placeUrl.county(state, d.county.slug)} className={LINK}>{d.county.name}</Link>. </>}
      </>}
      jsonLd={[placeJsonLd({ type: 'City', name: `${p.name}, ${name}`, path, population: p.population, lat: p.lat, lon: p.lon, containedIn: { name, path: placeUrl.state(state), type: 'State' } })]}
    >
      <JobList id="jobs" title={`Jobs in ${p.name}`} jobs={d.jobs}
        searchHref={`/jobs?loc=${encodeURIComponent(`${p.name}, ${code}`)}`} searchLabel={`Search all jobs in ${p.name}`}
        event="place_jobs_search_clicked" properties={{ level: 'city', state: code, city: p.slug }} />

      <div className="mt-8">
        <SaveSearchForm q="" loc={`${p.name}, ${code}`} remote={false} source="page:place" heading={`Get new jobs in ${p.name} by email`} blurb="We’ll email you when new jobs are posted here. No account needed." cta="Email me new jobs" />
      </div>

      <EmployerList id="hiring" title={`Employers hiring most in ${p.name}`} items={d.hiring} />
      <HeadquarteredList id="largest" title={`Largest employers headquartered in ${p.name}`} items={d.headquartered} />

      <LayoffsSection id="layoffs" title={`${p.name} layoffs`} scope={p.name} stats={d.layoffs} notices={d.notices} trackerHref={(await hasLayoffStatePage(code)) ? `/layoffs/${state}` : null} />

      <CollegeTable id="colleges" title={`Colleges in ${p.name}`} colleges={d.colleges} showCity={false} />

      <LocalEventSection id="local-events" title={`Job fairs and business events in ${p.name}`} intro={`Hiring events, career workshops and business events in ${p.name}.`} scope={{ state: code, cityKey: p.key }} />


      <ConferenceSection id="conferences" title={`Conferences in ${p.name}`} intro={`Industry conferences and trade shows held in ${p.name}.`}
        source={`place:city:${code}:${p.slug}`} load={() => conferencesAtPlace('city', code, p.slug, 12)} more={{ href: '/conferences', label: 'All conferences' }} />

      <WorkforceSection id="workforce" state={name} stateSlugValue={state} boards={d.boards} centers={d.centers} scope={p.name} />

      {d.county && (
        <EconomySection id="economy" title={`${d.county.name} economy`} labor={d.county} scope={d.county.name} />
      )}

      <PlaceLinks id="nearby" title={d.county ? `More cities in ${d.county.name}` : `More ${name} cities`}
        links={d.nearby.map((x) => ({ href: placeUrl.city(state, x.slug), label: x.name, note: x.jobs ? `${x.jobs.toLocaleString()} jobs` : undefined }))} />
      <p className="mt-4 text-sm"><Link href={placeUrl.state(state)} className={LINK}>All of {name}</Link></p>

      <ActionBand
        title={`Laid off or looking for work in ${p.name}?`}
        body="See what to do first and the jobs open near you."
        label="See your options after a layoff"
        href="/start/laid-off"
        event="place_cta_clicked"
        properties={{ level: 'city', state: code, city: p.slug }}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> WARN notices from {name}’s published record; job counts from our live job board, taken from employers’ own career sites;
        IPEDS for colleges; CareerOneStop for workforce boards and job centers; Census Bureau and BLS for county figures.
      </p>
    </SeoPage>
  )
}
