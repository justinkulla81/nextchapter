import { STATE_NAMES } from '@/lib/workforce/places'

/** URL slug for a state: "NY" → "new-york". */
export function stateSlug(code: string): string {
  return STATE_NAMES[code].toLowerCase().replace(/[^a-z]+/g, '-')
}

const BY_SLUG = Object.fromEntries(Object.keys(STATE_NAMES).map((c) => [stateSlug(c), c]))

/** "new-york" → "NY", or null. */
export function stateFromSlug(slug: string): string | null {
  return BY_SLUG[slug] ?? null
}

export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code
}

/** Every state plus DC, alphabetical by name. */
export const ALL_STATE_CODES = Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))
