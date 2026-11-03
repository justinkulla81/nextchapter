import { REGIONS } from '@/lib/rankings/regions'
import { familyOfRanking } from '@/lib/rankings/awards'
import { settingImage, stateImage, campusImage } from '@/lib/places/place-image'
import { industryImage, functionImage } from '@/lib/seo/topic-images'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { functionByName } from '@/lib/seo/topics'
import type { RankingIndexEntry } from '@/lib/rankings/types'

// The header picture for a ranking, from the pictures the site already has (public/images/topics): the job family's picture for a
// family list, the industry's for an industry list, the region's or state's scene for a regional list, a campus for college lists,
// and a city scene for the rest. The same list always gets the same picture.

/** The ranking-slug industry (best-cities-for-<slug>-jobs) to the industry picture on the industry pages. */
const INDUSTRY_PICTURE: Record<string, string> = {
  technology: 'technology-and-software', healthcare: 'healthcare-and-hospital-systems', 'financial-services': 'financial-services-and-banking',
  'professional-services': 'professional-services-and-consulting', 'manufacturing-and-industrial': 'manufacturing-and-industrial',
  'consumer-and-retail': 'retail-and-e-commerce', 'life-sciences-and-biotech': 'pharmaceuticals-and-biotech', 'aerospace-and-defense': 'aerospace-and-defense',
  education: 'education-and-edtech', government: 'government-and-public-sector', 'energy-and-utilities': 'energy-and-utilities',
  'media-and-entertainment': 'media-and-entertainment', nonprofit: 'nonprofit-and-social-impact', 'logistics-and-transportation': 'transportation-and-logistics',
  'construction-and-real-estate': 'construction-and-real-estate', telecommunications: 'telecommunications', 'agriculture-and-food': 'agriculture-and-food-production',
}
const REGION_PICTURE = new Set(['northeast', 'southeast', 'midwest', 'southwest', 'mountain', 'pacific'])
const STATE_CODE: Record<string, string> = Object.fromEntries(ALL_STATE_CODES.map((c) => [stateSlug(c), c]))

export function rankingImage(entry: Pick<RankingIndexEntry, 'slug' | 'measure' | 'scopeKind' | 'scopeId' | 'family'>): string {
  const fn = familyOfRanking(entry)
  const fnPicture = fn ? functionImage(functionByName(fn)?.name) : undefined
  if (fnPicture) return fnPicture
  const m = /^best-cities-for-(.+?)(?:-pay-vs-cost-of-living|-jobs)$/.exec(entry.slug)
  const ind = m && INDUSTRY_PICTURE[m[1]]
  if (ind) return industryImage(ind) ?? settingImage(1_000_000, entry.slug, 'city')
  if (entry.measure === 'collegepay' || entry.family === 'Higher education') return campusImage(entry.slug)
  if (entry.family === 'AI skills' || entry.measure === 'skillpay') return '/images/topics/function-data-and-analytics.webp'
  if (entry.scopeKind === 'region' && REGION_PICTURE.has(entry.scopeId)) return `/images/topics/place-region-${entry.scopeId}.webp`
  if (entry.scopeKind === 'region') {
    const first = REGIONS.find((r) => r.id === entry.scopeId)?.states[0]
    const pic = first ? stateImage(first) : undefined
    if (pic) return pic
  }
  if (entry.scopeKind === 'state') {
    const code = STATE_CODE[entry.scopeId]
    const pic = code ? stateImage(code) : undefined
    if (pic) return pic
  }
  return settingImage(1_000_000, entry.slug, 'city')
}

/** The picture for the rankings hub and archive pages. */
export const RANKINGS_HERO = '/images/topics/place-city-1.webp'
