// "Stay local": a workforce customer's region as an anchor city and a radius
// (Louisville, 40 miles), which crosses state lines the way a metro does
// (Jeffersonville and New Albany, IN are Louisville). Places come from the
// Census place list (GeoPlace), so a job or a new hire's "City, ST" can be
// checked without a geocoder call. Settings live in
// Institution.enabledFeatures.local.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { placeKeys } from './places'

export type LocalSettings = { anchorCity: string; anchorState: string; radiusMiles: number; label: string }

export function readLocal(enabledFeatures: unknown): LocalSettings | null {
  const o = (enabledFeatures as { local?: Partial<LocalSettings> } | null)?.local
  if (!o?.anchorCity || !o.anchorState) return null
  const radius = typeof o.radiusMiles === 'number' && o.radiusMiles >= 5 && o.radiusMiles <= 150 ? o.radiusMiles : 40
  return { anchorCity: o.anchorCity, anchorState: o.anchorState.toUpperCase(), radiusMiles: radius, label: o.label?.trim() || `the ${o.anchorCity} area` }
}

// Great-circle miles.
export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

// "Louisville, Kentucky, United States" → { city: 'Louisville', state: 'KY' }.
export function cityState(location: string | null | undefined): { city: string; state: string } | null {
  if (!location) return null
  const state = statesFromLocation(location).states[0]
  const city = location.split(/[,(|;]/)[0]?.trim()
  if (!state || !city || /remote|anywhere|united states/i.test(city)) return null
  return { city, state }
}

export async function placeAt(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  const p = await prisma.geoPlace.findFirst({ where: { state: state.toUpperCase(), nameKey: { in: placeKeys(city) } }, orderBy: { population: 'desc' }, select: { lat: true, lon: true } })
  return p
}

export type LocalArea = { label: string; radiusMiles: number; anchor: { lat: number; lon: number }; keys: Set<string> }

const key = (state: string, nameKey: string) => `${state}|${nameKey}`
const cache = new Map<string, { at: number; area: LocalArea | null }>()

// Every Census place inside the radius, keyed state|nameKey. Cached an hour per settings.
export async function localArea(s: LocalSettings): Promise<LocalArea | null> {
  const ck = `${s.anchorCity}|${s.anchorState}|${s.radiusMiles}`
  const hit = cache.get(ck)
  if (hit && Date.now() - hit.at < 3_600_000) return hit.area
  const anchor = await placeAt(s.anchorCity, s.anchorState)
  let area: LocalArea | null = null
  if (anchor) {
    const dLat = s.radiusMiles / 69
    const dLon = s.radiusMiles / (69 * Math.cos((anchor.lat * Math.PI) / 180))
    const places = await prisma.geoPlace.findMany({
      where: { lat: { gte: anchor.lat - dLat, lte: anchor.lat + dLat }, lon: { gte: anchor.lon - dLon, lte: anchor.lon + dLon } },
      select: { state: true, nameKey: true, lat: true, lon: true },
    })
    const keys = new Set(places.filter((p) => milesBetween(anchor, p) <= s.radiusMiles).map((p) => key(p.state, p.nameKey)))
    area = { label: s.label, radiusMiles: s.radiusMiles, anchor, keys }
  }
  cache.set(ck, { at: Date.now(), area })
  return area
}

export function isInArea(area: LocalArea, city: string | null | undefined, state: string | null | undefined): boolean {
  if (!city || !state) return false
  return placeKeys(city).some((k) => area.keys.has(key(state.toUpperCase(), k)))
}

export function isLocationInArea(area: LocalArea, location: string | null | undefined): boolean {
  const cs = cityState(location)
  return !!cs && isInArea(area, cs.city, cs.state)
}

// The stay-local area for a candidate: the first workforce org they belong
// to that has its region set. Null for everyone else.
export async function localAreaForCandidate(candidateId: string): Promise<LocalArea | null> {
  const m = await prisma.institutionMember.findFirst({
    where: { candidateId, status: { not: 'OPTED_OUT' }, institution: { orgType: { not: 'COLLEGE' } } },
    select: { institution: { select: { enabledFeatures: true } } },
  })
  const s = m ? readLocal(m.institution.enabledFeatures) : null
  return s ? localArea(s) : null
}
