import { SITE_URL } from '@/lib/seo/facts'
import type { LocalEventRow } from './queries'

/** schema.org Event for one listed event. Google needs a name, a start date and a place (or a virtual location). */
export function eventJsonLd(e: LocalEventRow): Record<string, unknown> {
  const virtual = e.format === 'VIRTUAL'
  const host = e.hosts.find((h) => h.role === 'HOST')
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.startsAt.toISOString(),
    ...(e.endsAt ? { endDate: e.endsAt.toISOString() } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: virtual ? 'https://schema.org/OnlineEventAttendanceMode' : e.format === 'HYBRID' ? 'https://schema.org/MixedEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: virtual
      ? { '@type': 'VirtualLocation', url: e.registerUrl ?? e.url ?? SITE_URL }
      : { '@type': 'Place', name: e.venue ?? [e.city, e.state].filter(Boolean).join(', '), address: { '@type': 'PostalAddress', addressLocality: e.city ?? undefined, addressRegion: e.state ?? undefined, addressCountry: 'US' } },
    ...(e.registerUrl ?? e.url ? { url: e.registerUrl ?? e.url } : {}),
    ...(host ? { organizer: { '@type': 'Organization', name: host.name } } : {}),
    ...(e.cost && /free/i.test(e.cost) ? { isAccessibleForFree: true } : {}),
  }
}
