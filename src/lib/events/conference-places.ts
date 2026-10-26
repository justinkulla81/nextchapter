import 'server-only'
import { catalogConferences, type CatalogRow } from '@/lib/seo/topic-data'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { collegePath } from '@/lib/seo/college-bar'
import { getStateCollegeListings } from '@/lib/seo/college-pages'
import places from './conference-places.json'
import hosted from './conference-colleges.json'

// Cross-references between conferences and the place and higher-education pages. Nothing here reads the database except through the
// cached catalog (getCatalogIndex, one query an hour) and, for a hosted college, that college's state list.
//
//  - Places: conference-places.json (scripts/seo/build-conference-places.ts) says which city and county page a conference's city
//    maps to; the state page comes from the conference's own state code.
//  - Higher education: a conference links to a college page only when the college is its organizer (conference-colleges.json,
//    exact name match against IPEDS, unambiguous only). Everything else links to the higher-education hub and the state's college list.

const PLACES = places as Record<string, { c?: string; cn?: string; k?: string; kn?: string }>
const HOSTS = hosted as Record<string, { state: string; unitid: string }>

type Located = { id: string; state: string | null }
export interface PlaceRef { href: string; label: string; level: 'city' | 'county' | 'state' }

/** The place pages a conference belongs to, narrowest first. Empty when it has no US state (virtual or abroad). */
export function placeRefs(c: Located): PlaceRef[] {
  if (!c.state || !ALL_STATE_CODES.includes(c.state)) return []
  const s = stateSlug(c.state)
  const p = PLACES[c.id]
  const out: PlaceRef[] = []
  if (p?.c && p.cn) out.push({ level: 'city', label: p.cn, href: `/places/${s}/city/${p.c}` })
  if (p?.k && p.kn) out.push({ level: 'county', label: p.kn, href: `/places/${s}/county/${p.k}` })
  out.push({ level: 'state', label: stateName(c.state), href: `/places/${s}` })
  return out
}

/** Conferences held in a place: upcoming first, soonest first. */
export function conferencesAtPlace(level: 'state' | 'city' | 'county', stateCode: string, slug: string | null, take: number) {
  return catalogConferences((r) => {
    if (r.state !== stateCode) return false
    if (level === 'state') return true
    const p = PLACES[r.id]
    return level === 'city' ? p?.c === slug : p?.k === slug
  }, take)
}

const K12_ONLY = /k-12|early childhood|education policy|career and technical|adult education/i

/** An education conference for colleges and universities: education industry, unless every segment it names is K-12, early childhood, policy or technical education. */
export function isHigherEd(r: Pick<CatalogRow, 'industries' | 'segments'>): boolean {
  if (!r.industries.includes('Education & EdTech')) return false
  return r.segments.length === 0 || r.segments.some((s) => !K12_ONLY.test(s))
}

export const higherEdConferencesIn = (stateCode: string, take: number) => catalogConferences((r) => r.state === stateCode && isHigherEd(r), take)

/** The college page of the college that hosts the conference, when the organizer is that college. */
export async function hostCollege(confId: string): Promise<{ name: string; href: string } | null> {
  const h = HOSTS[confId]
  if (!h) return null
  try {
    const c = (await getStateCollegeListings(h.state)).find((x) => x.unitid === h.unitid)
    return c && c.indexable ? { name: c.name, href: collegePath(stateSlug(h.state), c.slug) } : null
  } catch {
    return null
  }
}

export const conferencesHostedBy = (unitid: string, take = 12) => catalogConferences((r) => HOSTS[r.id]?.unitid === unitid, take)
export const hasHostedConferences = (unitid: string) => Object.values(HOSTS).some((h) => h.unitid === unitid)
