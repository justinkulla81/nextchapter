import { SITE_URL } from '@/lib/seo/facts'

/** schema.org Place for a state, county or city page, nested in the place that contains it. */
export function placeJsonLd(p: { type: 'State' | 'AdministrativeArea' | 'City'; name: string; path: string; population?: number | null; lat?: number; lon?: number; containedIn?: { name: string; path: string; type: string } }) {
  return {
    '@context': 'https://schema.org',
    '@type': p.type,
    name: p.name,
    url: `${SITE_URL}${p.path}`,
    ...(p.lat != null && p.lon != null ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon } } : {}),
    ...(p.population ? { additionalProperty: { '@type': 'PropertyValue', name: 'Population', value: p.population } } : {}),
    ...(p.containedIn ? { containedInPlace: { '@type': p.containedIn.type, name: p.containedIn.name, url: `${SITE_URL}${p.containedIn.path}` } } : {}),
  }
}
