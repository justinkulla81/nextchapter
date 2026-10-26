import { TrackedLink } from '@/components/marketing/TrackedLink'
import { localEvents, type LocalEventRow, type LocalEventScope } from '@/lib/local-events/queries'
import { hostKey, hostLinkMap } from '@/lib/local-events/hosts'

const KIND_LABEL: Record<string, string> = {
  JOB_FAIR: 'Job fair', HIRING_EVENT: 'Hiring event', CAREER_WORKSHOP: 'Career workshop', NETWORKING: 'Networking', RAPID_RESPONSE: 'Job-transition session',
  STARTUP_WORKSHOP: 'Starting a business', SMALL_BUSINESS_COUNSELING: 'Small-business counseling', PITCH: 'Pitch event', FUNDING: 'Funding', BUSINESS_NETWORKING: 'Business networking', OTHER: 'Event',
}
const HOST_LABEL: Record<string, string> = { CHAMBER: 'Chamber', JOB_CENTER: 'Job center', WORKFORCE_BOARD: 'Workforce board', ECON_DEV: 'Economic development', RAPID_RESPONSE: 'Rapid response', CITY: 'City', STATE_AGENCY: 'State agency', COLLEGE: 'College', SCORE: 'SCORE', SBDC: 'SBDC / SBA partner', COMPANY: 'Company' }
const when = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

function Row({ e, links }: { e: LocalEventRow; links: Map<string, string> }) {
  const href = e.registerUrl ?? e.url
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand">{KIND_LABEL[e.kind] ?? 'Event'}</span>
        <span className="text-xs text-muted-foreground">{when(e.startsAt)}{e.format === 'VIRTUAL' ? ' · Online' : e.city ? ` · ${e.city}${e.state ? `, ${e.state}` : ''}` : ''}{e.cost ? ` · ${e.cost}` : ''}</span>
      </div>
      <p className="mt-1 font-medium text-navy">{href ? <TrackedLink href={href} rel="nofollow" event="local_event_clicked" properties={{ eventId: e.id, kind: e.kind, track: e.track, state: e.state, target: 'event' }} className="underline-offset-4 hover:underline">{e.title}</TrackedLink> : e.title}</p>
      {e.hosts.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {e.hosts.map((h, i) => {
            const to = links.get(hostKey(h))
            return (
              <span key={`${h.kind}${h.id}${h.role}`}>
                {i > 0 && ' · '}{h.role === 'SPONSOR' ? 'Sponsored by ' : h.role === 'EMPLOYER' ? 'Hiring: ' : h.role === 'PARTNER' ? 'With ' : `${HOST_LABEL[h.kind] ?? 'Host'}: `}
                {to ? <TrackedLink href={to} event="local_event_clicked" properties={{ eventId: e.id, kind: e.kind, track: e.track, state: e.state, target: 'host', hostKind: h.kind }} className="text-brand underline underline-offset-2">{h.name}</TrackedLink> : h.name}
              </span>
            )
          })}
        </p>
      )}
    </li>
  )
}

/** A list of events with host links, for pages that load their own rows. */
export async function LocalEventList({ rows }: { rows: LocalEventRow[] }) {
  const links = await hostLinkMap(rows)
  return <ul className="mt-4 grid gap-3 md:grid-cols-2">{rows.map((e) => <Row key={e.id} e={e} links={links} />)}</ul>
}

/** Job fairs, hiring events and entrepreneurship events for a place or an org. Renders nothing when there are none. */
export async function LocalEventSection({ id, title, intro, scope, take = 12 }: {
  id: string; title: string; intro?: string; take?: number
  scope: LocalEventScope
}) {
  const rows = await localEvents(scope, take)
  if (rows.length === 0) return null
  const links = await hostLinkMap(rows)
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">{rows.map((e) => <Row key={e.id} e={e} links={links} />)}</ul>
    </section>
  )
}
