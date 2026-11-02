// The header picture on place pages (public/images/topics/place-*.webp, made once by scripts/topic-images/generate.ts): one of six
// regional scenes for a state, and for a county or city one of three settings (big city, mid-size city, small town) with three
// variants each, picked from the place's slug so a place always shows the same picture. src/test/place-image.test.ts checks every
// file this can return exists.

const REGIONS: Record<string, string[]> = {
  northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  southeast: ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
  midwest: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
  southwest: ['OK', 'TX', 'NM', 'AZ'],
  mountain: ['CO', 'UT', 'WY', 'MT', 'ID', 'NV'],
  pacific: ['CA', 'OR', 'WA', 'AK', 'HI'],
}
const REGION_OF = new Map(Object.entries(REGIONS).flatMap(([r, codes]) => codes.map((c) => [c, r] as const)))

export const PLACE_IMAGE_FILES = [
  ...Object.keys(REGIONS).map((r) => `place-region-${r}`),
  ...['city', 'town', 'rural'].flatMap((s) => [1, 2, 3].map((n) => `place-${s}-${n}`)),
].map((f) => `/images/topics/${f}.webp`)

const url = (f: string) => `/images/topics/${f}.webp`

/** A state's regional scene, or undefined for a code outside the six regions. */
export function stateImage(code: string): string | undefined {
  const r = REGION_OF.get(code.toUpperCase())
  return r ? url(`place-region-${r}`) : undefined
}

const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

/** A county's or city's picture by size: 500,000 and up a big city, 50,000 and up a mid-size city, otherwise a small town. */
export function settingImage(population: number | null | undefined, slug: string, kind: 'city' | 'county'): string {
  const p = population ?? 0
  const setting = p >= 500_000 ? 'city' : p >= 50_000 ? 'town' : 'rural'
  const n = (hash(`${kind}:${slug}`) % 3) + 1
  return url(`place-${setting}-${n}`)
}
