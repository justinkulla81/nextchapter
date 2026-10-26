import Link from 'next/link'
import { H2 } from '@/components/candidate/ui'
import { LocalEventList } from '@/components/events/LocalEventSection'
import { localEvents } from '@/lib/local-events/queries'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

// "Events near you" on the Start a business page: startup workshops, SBDC and SCORE counseling, pitch and funding events in the member's
// state, then online ones open to anyone. Read from the local events catalog (cached an hour); nothing here costs per view.
export async function StartEventsTab({ state }: { state: string | null }) {
  const code = state && ALL_STATE_CODES.includes(state.toUpperCase()) ? state.toUpperCase() : null
  const [near, online] = await Promise.all([
    code ? localEvents({ state: code, track: 'ENTREPRENEUR' }, 12) : Promise.resolve([]),
    localEvents({ online: true, track: 'ENTREPRENEUR' }, 8),
  ])
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="events-near">
        <H2 id="events-near">{code ? `In ${stateName(code)}` : 'Near you'}</H2>
        {code ? (
          near.length > 0 ? <LocalEventList rows={near} /> : <p className="text-sm text-muted-foreground">No startup or small-business events are listed for {stateName(code)} right now. Check back next week; the list refreshes weekly.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Add your location to your profile to see events in your state.</p>
        )}
        {code && <p className="text-sm"><Link href={`/events/${stateSlug(code)}`} className="text-brand underline underline-offset-4">All {stateName(code)} events, including job fairs</Link></p>}
      </section>
      {online.length > 0 && (
        <section className="space-y-3" aria-labelledby="events-online">
          <H2 id="events-online">Online, open to anyone</H2>
          <LocalEventList rows={online} />
        </section>
      )}
    </div>
  )
}
