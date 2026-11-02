import 'server-only'
import { permanentRedirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ALL_STATE_CODES, stateFromSlug, stateSlug } from '@/lib/seo/states'
import { slugify } from '@/lib/seo/workforce-pages'
import { cityDisplayName, getStateCities, getStateCityPlaces, getStateCounties, placeUrl } from '@/lib/places/places'

// Place addresses people type, paste with a sentence's full stop on the end, or guess ("/places/los-angeles",
// "/places/new-york/city/new-york-city"). Each helper sends a near miss to the real page with a permanent redirect and
// returns when it has no better address, so the caller can 404.

/** "Los-Angeles-County." → "los-angeles-county": lower case, no trailing punctuation or stray hyphens. */
export function tidySlug(raw: string): string {
  let s = raw
  try { s = decodeURIComponent(raw) } catch { /* keep the raw text */ }
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const COUNTY_WORDS = /-(county|parish|borough|census-area|municipality)$/
const CITY_WORDS = /-(city|town|village|cdp)$/

/** The slug as given, then with the state's name or code on the end removed ("los-angeles-ca" → "los-angeles"). */
function withoutState(slug: string, stateCode: string | null): string[] {
  if (!stateCode) return [slug]
  const tails = [stateSlug(stateCode), stateCode.toLowerCase()]
  for (const t of tails) if (slug.endsWith(`-${t}`)) return [slug, slug.slice(0, -t.length - 1)]
  return [slug]
}

/** A county page address that does not exist → the real county page, or nothing. */
export async function redirectToCounty(stateSlugValue: string, rawSlug: string): Promise<void> {
  const code = stateFromSlug(stateSlugValue)
  if (!code) return
  const tidy = tidySlug(rawSlug)
  const counties = await getStateCounties(code)
  const base = tidy.replace(COUNTY_WORDS, '')
  for (const c of [tidy, base, `${base}-county`, `${base}-parish`]) {
    const hit = counties.find((x) => x.slug === c)
    if (hit && hit.slug !== rawSlug) permanentRedirect(placeUrl.county(stateSlugValue, hit.slug))
  }
}

/** A city page address that does not exist → the real city page, else its county or state page, or nothing. */
export async function redirectToCity(stateSlugValue: string, rawSlug: string, fromElsewhere = false): Promise<void> {
  const code = stateFromSlug(stateSlugValue)
  if (!code) return
  const tidy = tidySlug(rawSlug)
  const [places, entries] = await Promise.all([getStateCityPlaces(code), getStateCities(code)])
  const live = new Set(entries.map((e) => e.slug))
  const candidates = withoutState(tidy, code).flatMap((s) => [s, s.replace(CITY_WORDS, '')])
  for (const c of candidates) {
    const place = places.find((p) => p.slug === c)
    if (!place) continue
    if (live.has(place.slug)) {
      // On the city route itself a match for the slug as given is the page, not a redirect target.
      if (fromElsewhere || place.slug !== rawSlug) permanentRedirect(placeUrl.city(stateSlugValue, place.slug))
      return
    }
    // A real place with too little of its own to have a page: its county is the nearest useful page.
    const county = place.county ? (await getStateCounties(code)).find((x) => x.name === place.county) : null
    permanentRedirect(county ? placeUrl.county(stateSlugValue, county.slug) : placeUrl.state(stateSlugValue))
  }
}

const NOT_A_CITY = /\s(township|precinct|district|division|plantation|ccd|county|parish)$/i
const CITY_LIKE = /\s(city|town|village|cdp|borough|municipality|city and borough|\(balance\))$|(metropolitan|consolidated|unified) government/i

/** "saint-louis" and "st-louis" are written "St. Louis" in the Census names. */
function spellings(words: string[]): string[] {
  const [first, ...rest] = words
  const tail = rest.join(' ')
  if (first === 'st' || first === 'saint') return [`St. ${tail}`, `Saint ${tail}`]
  if (first === 'ft') return [`Fort ${tail}`]
  return [words.join(' '), `Urban ${words.join(' ')}`]
}

/** The biggest city whose slug is this, in the state the slug ends in ("los-angeles-ca") if it names one. */
async function biggestCityNamed(slug: string): Promise<{ state: string; slug: string } | null> {
  const tails = ALL_STATE_CODES.flatMap((code) => [stateSlug(code), code.toLowerCase()].map((t) => ({ code, t })))
    .filter(({ t }) => slug.endsWith(`-${t}`))
    .sort((x, y) => y.t.length - x.t.length)
  const tries = [...tails.map(({ code, t }) => ({ state: code, name: slug.slice(0, -t.length - 1) })), { state: null, name: slug }]
  for (const { state, name } of tries) {
    // "oklahoma-city" is a whole name; "new-york-city" and "los-angeles-city" are the name plus a word. Try both.
    for (const base of [name, name.replace(CITY_WORDS, '')]) {
      const words = base.split('-').filter(Boolean)
      if (!words.length || (base !== name && base === '')) continue
      const rows = (await Promise.all(spellings(words).map((q) => prisma.geoPlace.findMany({
        where: { name: { startsWith: q, mode: 'insensitive' }, ...(state ? { state } : {}) },
        select: { state: true, name: true },
        orderBy: [{ population: { sort: 'desc', nulls: 'last' } }],
        take: 60,
      })))).flat()
      const target = slugify(spellings(words)[0])
      // Boise's Census name is "Boise City city"; Honolulu's is "Urban Honolulu CDP".
      const names = new Set([target, `${target}-city`, `urban-${target}`])
      const named = rows.filter((r) => {
        if (NOT_A_CITY.test(r.name)) return false
        const got = slugify(cityDisplayName(r.name))
        // A consolidated government is its main city's name plus the county's ("nashville-davidson").
        return names.has(got) || (/(metropolitan|consolidated|unified) government/i.test(r.name) && got.startsWith(`${target}-`))
      })
      // Land area is the order the rows came in; a place the Census calls a city outranks a bare name.
      const hit = named.find((r) => CITY_LIKE.test(r.name)) ?? named[0]
      if (hit) return { state: hit.state, slug: slugify(cityDisplayName(hit.name)) }
    }
  }
  return null
}

/**
 * /places/<something that is not a state>. A trailing full stop or capital letters on a state go to the state; a city
 * name ("los-angeles", "los-angeles-ca", "new-york-city") goes to that city's page, the biggest one if several
 * states have one. Returns when it is neither.
 */
export async function redirectFromBareSlug(rawSlug: string): Promise<void> {
  const tidy = tidySlug(rawSlug)
  if (stateFromSlug(tidy)) permanentRedirect(placeUrl.state(tidy))
  const hit = await biggestCityNamed(tidy)
  if (!hit) return
  const stateSlugValue = stateSlug(hit.state)
  await redirectToCity(stateSlugValue, hit.slug, true)
  permanentRedirect(placeUrl.state(stateSlugValue))
}
