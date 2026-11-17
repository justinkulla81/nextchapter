// The splash picture for a workforce demo: an iconic, good-looking view of the city (its skyline or a well-known landmark),
// found on Wikimedia Commons when the demo is made. Owner request (2026-11-17): nice-looking only, nothing grim.
//
// Only photos Commons volunteers reviewed as Quality images or Featured pictures are considered, then only wide, large,
// freely licensed ones whose titles name nothing unpleasant. The credit is kept with the URL: CC BY and BY-SA licenses
// require it. One search request per query (at most three), only when a demo is created; nothing on a page view.

import 'server-only'

export type CityHero = { url: string; credit: string; sourceUrl: string }

const API = 'https://commons.wikimedia.org/w/api.php'
// Wikimedia asks automated clients for a descriptive user agent with a contact address (the site, not a person).
const UA = 'NextChapter-demo/1.0 (https://launchyournextchapter.com)'
const OK_LICENSE = /^(cc0|public domain|pd|cc by(-sa)? \d)/i
// Words in a file title that mean the picture is not one to put on a welcome screen.
const AVOID = /\b(homeless\w*|protest\w*|riot\w*|fire|fires|flood\w*|crash\w*|accident\w*|wreck\w*|demoli\w*|ruin\w*|abandon\w*|vacant|blight\w*|graffiti|trash|garbage|crime\w*|police|funeral\w*|cemetery|cemeteries|grave\w*|prison\w*|jail\w*|storm|tornado\w*|damage\w*|construction|interior\w*|map|maps|diagram\w*|logo\w*|flag|flags|seal|chart\w*|signs?)\b/i

export type Page = { title: string; imageinfo?: { thumburl?: string; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[] }

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

async function search(query: string): Promise<CityHero | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Artist',
    iiurlwidth: '1600',
  })
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  const data = (await res.json()) as { query?: { pages?: Record<string, Page & { index?: number }> } }
  return pickHero(Object.values(data.query?.pages ?? {}))
}

// The first search result (in search order) that is wide, large, freely licensed and has a title with nothing unpleasant in it.
export function pickHero(results: (Page & { index?: number })[]): CityHero | null {
  const pages = [...results].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii?.thumburl) continue
    const license = stripHtml(ii.extmetadata?.LicenseShortName?.value ?? '')
    if (!OK_LICENSE.test(license)) continue
    if (ii.width < 1600 || ii.width / ii.height < 1.4) continue
    if (AVOID.test(p.title)) continue
    const artist = stripHtml(ii.extmetadata?.Artist?.value ?? '') || 'Wikimedia Commons contributor'
    // Commons adds tracking parameters to thumbnail links; the image loads the same without them.
    return { url: ii.thumburl.split('?')[0], credit: `Photo: ${artist.slice(0, 80)}, ${license}, via Wikimedia Commons`, sourceUrl: ii.descriptionurl }
  }
  return null
}

// Skyline first, then any reviewed picture of the city, then featured pictures. Null when nothing passes: the hub shows its
// placeholder and the organization can upload its own in Admin, Branding.
export async function findCityHero(city: string, stateName: string): Promise<CityHero | null> {
  const name = `"${city.replace(/"/g, '')}"`
  const queries = [
    `${name} skyline incategory:Quality_images`,
    `${name} ${stateName} incategory:Quality_images`,
    `${name} incategory:Featured_pictures_on_Wikimedia_Commons`,
  ]
  for (const q of queries) {
    try {
      const hit = await search(q)
      if (hit) return hit
    } catch {
      // A slow or refused search leaves the placeholder; making the demo never waits on it.
    }
  }
  return null
}
