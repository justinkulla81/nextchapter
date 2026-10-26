import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage } from '@/components/seo/SeoPage'
import { LocalEventList } from '@/components/events/LocalEventSection'
import { canonical } from '@/lib/seo/canonical'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'
import { EVENTS_STATE_MIN, localEvents, type LocalEventRow } from '@/lib/local-events/queries'
import { eventJsonLd } from '@/lib/local-events/jsonld'

export const revalidate = 3600

const GROUPS: { id: string; title: string; intro: string; kinds: string[] }[] = [
  { id: 'jobs', title: 'Job fairs and hiring events', intro: 'Career fairs and employer hiring events.', kinds: ['JOB_FAIR', 'HIRING_EVENT'] },
  { id: 'careers', title: 'Career workshops and networking', intro: 'Résumé, interview and job-search workshops, networking, and sessions for people who were laid off.', kinds: ['CAREER_WORKSHOP', 'NETWORKING', 'RAPID_RESPONSE'] },
  { id: 'business', title: 'Starting and running a business', intro: 'Startup workshops, small-business counseling, pitch events, funding sessions and business networking.', kinds: ['STARTUP_WORKSHOP', 'SMALL_BUSINESS_COUNSELING', 'PITCH', 'FUNDING', 'BUSINESS_NETWORKING'] },
]

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const rows = await localEvents({ state: code }, 150)
  return { code, name: stateName(code), rows }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const s = await load(state)
  if (!s) return {}
  return {
    title: titleMeta(`${s.name} Job Fairs and Business Events`),
    description: `${s.rows.length} upcoming job fairs, hiring events, career workshops, small-business counseling and startup events in ${s.name}, from chambers, workforce boards, SBDCs, SCORE, colleges and cities.`,
    ...canonical(`/events/${state}`),
    // Events come and go; a state with only a few is shown to visitors but not offered to search engines.
    ...(s.rows.length < EVENTS_STATE_MIN ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function StateEventsPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const s = await load(state)
  if (!s) notFound()
  const { name, rows } = s
  const byGroup = GROUPS.map((g) => ({ ...g, rows: rows.filter((r: LocalEventRow) => g.kinds.includes(r.kind)) })).filter((g) => g.rows.length > 0)
  return (
    <SeoPage
      trail={[{ name: 'Events', path: '/events' }, { name, path: `/events/${state}` }]}
      h1={`${name} job fairs and business events`}
      lede={<>{rows.length === 0 ? `No upcoming events are listed for ${name} right now.` : `${rows.length} upcoming events in ${name}.`} Taken from the event pages of chambers of commerce, workforce boards, economic-development groups, SBDCs, SCORE chapters, colleges and city governments, and refreshed every week. For the local job market, see <Link href={`/places/${state}`} className="text-brand underline underline-offset-4">{name} jobs, employers and layoffs</Link>.</>}
      jsonLd={rows.slice(0, 40).map(eventJsonLd)}
    >
      {byGroup.map((g) => (
        <section key={g.id} aria-labelledby={g.id} className="mt-12">
          <h2 id={g.id} className="text-2xl font-bold tracking-tight text-navy">{g.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{g.intro}</p>
          <LocalEventList rows={g.rows} />
        </section>
      ))}
    </SeoPage>
  )
}
