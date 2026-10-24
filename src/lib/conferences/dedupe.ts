import { nameKey } from './canonical'

export interface SeriesKey { id: string; name: string; urlKey: string | null }
export type DedupeHit = { id: string; by: 'url' | 'name' } | null

/**
 * Finds the catalog series a pasted link already is. Order: canonical URL exact, then the same registrable host
 * with an equivalent name, then name alone only when the names are long enough to be distinctive.
 * Never guesses on short or generic names: a miss makes a new unpublished entry that an admin can merge.
 */
export function findExistingSeries(rows: SeriesKey[], input: { urlKey: string | null; name: string | null }): DedupeHit {
  if (input.urlKey) {
    const exact = rows.find((r) => r.urlKey === input.urlKey)
    if (exact) return { id: exact.id, by: 'url' }
    const host = input.urlKey.split('/')[0]
    const sameHost = rows.filter((r) => r.urlKey?.split('/')[0] === host)
    if (sameHost.length === 1 && input.urlKey.split('/').length <= 2) return { id: sameHost[0].id, by: 'url' }
  }
  const key = input.name ? nameKey(input.name) : ''
  if (key.length >= 6) {
    const hit = rows.find((r) => nameKey(r.name) === key)
    if (hit) return { id: hit.id, by: 'name' }
  }
  return null
}
