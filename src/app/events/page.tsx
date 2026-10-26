import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage } from '@/components/seo/SeoPage'
import { LocalEventList } from '@/components/events/LocalEventSection'
import { PlaceLinks } from '@/components/places/PlaceSections'
import { canonical } from '@/lib/seo/canonical'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { EVENTS_STATE_MIN, eventStateCounts, localEvents } from '@/lib/local-events/queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Job Fairs and Business Events Near You, by State',
  description: 'Upcoming job fairs, hiring events, career workshops, small-business counseling and startup events from chambers, workforce boards, SBDCs, SCORE, colleges and cities, by state.',
  ...canonical('/events'),
}

export default async function EventsHubPage() {
  const [counts, online] = await Promise.all([eventStateCounts(), localEvents({ online: true }, 8)])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const states = ALL_STATE_CODES.filter((c) => (counts[c] ?? 0) > 0)
  return (
    <SeoPage
      trail={[{ name: 'Events', path: '/events' }]}
      h1="Job fairs and business events near you"
      lede={<>{total.toLocaleString()} upcoming events for professionals and founders: career fairs and hiring events, résumé and career workshops, small-business counseling, and startup events. Read from the event pages of chambers of commerce, workforce boards, economic-development groups, SBDCs, SCORE chapters, colleges and city governments, and refreshed every week.</>}
    >
      <PlaceLinks id="states" title="Choose a state"
        links={states.map((c) => ({ href: `/events/${stateSlug(c)}`, label: stateName(c), note: `${counts[c]} upcoming` }))} />
      {online.length > 0 && (
        <section aria-labelledby="online" className="mt-12">
          <h2 id="online" className="text-2xl font-bold tracking-tight text-navy">Online events open to anyone</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Virtual workshops from SBDCs, SCORE and the SBA that you can join from any state.</p>
          <LocalEventList rows={online} />
        </section>
      )}
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        States with fewer than {EVENTS_STATE_MIN} upcoming events are still listed for visitors. Looking for industry conferences instead? See <Link href="/conferences" className="text-brand underline underline-offset-4">all conferences</Link>.
      </p>
    </SeoPage>
  )
}
