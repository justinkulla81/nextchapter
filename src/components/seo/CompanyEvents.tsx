import { H2 } from '@/components/seo/SeoPage'
import type { eventsForCompanyIds } from '@/lib/events/sec-events'

type Event = Awaited<ReturnType<typeof eventsForCompanyIds>>[number]

const KIND: Record<string, string> = { ACQUISITION: 'Acquisition or sale', LEADERSHIP: 'Leadership change', FUNDRAISE: 'Capital raised' }
const day = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Acquisitions, leadership changes and capital raised, each linked to the SEC filing it comes from. Renders nothing when there are none. */
export function CompanyEvents({ id, title, intro, events, showCompany = false }: { id: string; title: string; intro: string; events: Event[]; showCompany?: boolean }) {
  if (events.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{intro}</p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <span>
              {showCompany && <span className="font-medium text-navy">{e.company.name}: </span>}
              <span className="text-xs text-muted-foreground">{KIND[e.kind] ?? e.kind}</span> · {e.headline}
            </span>
            <span className="text-xs text-muted-foreground">
              <time dateTime={e.eventDate.toISOString().slice(0, 10)}>{day(e.eventDate)}</time> ·{' '}
              <a href={e.sourceUrl} rel="nofollow noopener" className="underline">SEC filing</a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
