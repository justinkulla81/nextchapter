import { buildPair, type BrandPair } from './scan'
import { stateFromSlug, stateName } from '@/lib/seo/states'

// Each state's colors for its own pages, taken from the state flag: public symbols, so there is nothing to scan and nothing to mistake for an
// organization. Approximations of the flag colors, chosen to read well as a page band (see the contrast rules in colors.ts).
const FLAG: Record<string, [string, string]> = {
  AL: ['#A6192E', '#FFFFFF'], AK: ['#00205B', '#FFC72C'], AZ: ['#002B5C', '#C8742B'], AR: ['#C8102E', '#002868'], CA: ['#C8102E', '#6B4423'],
  CO: ['#002868', '#FFC72C'], CT: ['#1F3A6E', '#FFFFFF'], DE: ['#00539F', '#F1C40F'], DC: ['#BF0D3E', '#FFFFFF'], FL: ['#C8102E', '#003F87'],
  GA: ['#BF0A30', '#002868'], HI: ['#002868', '#C8102E'], ID: ['#004B87', '#FFCD00'], IL: ['#13294B', '#F5A623'], IN: ['#00205B', '#FFC72C'],
  IA: ['#002D72', '#C8102E'], KS: ['#002868', '#FFC72C'], KY: ['#1D2F5C', '#FFD100'], LA: ['#00338D', '#FFC72C'], ME: ['#002868', '#C8102E'],
  MD: ['#C8102E', '#FFC72C'], MA: ['#002868', '#C8102E'], MI: ['#002868', '#FFC72C'], MN: ['#002868', '#7AC9E6'], MS: ['#002868', '#C8102E'],
  MO: ['#002868', '#C8102E'], MT: ['#002868', '#FFC72C'], NE: ['#002868', '#FFC72C'], NV: ['#003B6F', '#A5ACAF'], NH: ['#002868', '#FFC72C'],
  NJ: ['#1F3A6E', '#D8B66A'], NM: ['#FFC72C', '#BF0A30'], NY: ['#002868', '#FFC72C'], NC: ['#002868', '#BF0A30'], ND: ['#002868', '#FFC72C'],
  OH: ['#BF0A30', '#002868'], OK: ['#0057B8', '#D4A017'], OR: ['#003B6F', '#FFC72C'], PA: ['#002868', '#FFC72C'], RI: ['#002868', '#FFC72C'],
  SC: ['#0033A0', '#A1A5A9'], SD: ['#006BA6', '#FFC72C'], TN: ['#C8102E', '#002868'], TX: ['#002868', '#BF0A30'], UT: ['#002868', '#FFC72C'],
  VT: ['#00674F', '#FFC72C'], VA: ['#002868', '#C8102E'], WA: ['#00573F', '#FFC72C'], WV: ['#002868', '#FFC72C'], WI: ['#002868', '#C8102E'],
  WY: ['#002868', '#C8102E'], PR: ['#ED0000', '#0050F0'],
}

export function stateBrand(code: string | null | undefined): BrandPair | null {
  const c = code ? FLAG[code] : undefined
  return c ? buildPair(c[0].toLowerCase(), c[1].toLowerCase()) : null
}

export function stateBrandFromSlug(slug: string | null | undefined): { code: string; brand: BrandPair } | null {
  const code = slug ? stateFromSlug(slug) : null
  const brand = stateBrand(code)
  return code && brand ? { code, brand } : null
}

/** How the page names the state in its independence line: "the State of Ohio", "the District of Columbia", "Puerto Rico". */
export function statePhrase(code: string): string {
  if (code === 'DC') return 'the District of Columbia'
  if (code === 'PR') return 'Puerto Rico'
  return `the State of ${stateName(code)}`
}
