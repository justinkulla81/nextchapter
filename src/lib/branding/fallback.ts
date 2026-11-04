import { buildPair, type BrandPair } from './scan'
import type { OrgBrandRecord } from './store'

// The colors of a page whose organization has none on file: one pair from a small set of NextChapter-chosen palettes, picked from the
// organization's key so it is always the same pair and the same pair on every page of that organization. It is never presented as the
// organization's own brand (no page says so); it only means no public page is without color. A real pair, read from the organization's
// website or set by hand, always wins over it. Pure: the store and the pages share it, and the tests check every pair reads.

// [primary, secondary]. Every primary reads under white text (4.5:1 or better); the secondary is the lighter accent.
export const FALLBACK_PALETTE: readonly (readonly [string, string])[] = [
  ['#1f4e79', '#e0a43a'], ['#17595f', '#e3b04b'], ['#5b2a6e', '#e0a458'], ['#8a2c2c', '#e6b86a'],
  ['#2e4a2f', '#c9a227'], ['#3c3f7a', '#f0b429'], ['#0f5c7a', '#f2994a'], ['#6b3e26', '#d8b365'],
  ['#1e3a5f', '#5aa9a0'], ['#7a2e4d', '#e8a87c'], ['#274c3a', '#9fcfae'], ['#324a7c', '#7fb7d4'],
  ['#5a3d7a', '#b8a1d9'], ['#8c4a1e', '#e3c07a'], ['#1b5e6b', '#8fd0c4'], ['#4a5568', '#c8a96a'],
]

/** A stable 32-bit hash of the key (FNV-1a). */
function hash(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function fallbackPair(key: string): BrandPair {
  const [primary, secondary] = FALLBACK_PALETTE[hash(key) % FALLBACK_PALETTE.length]
  return buildPair(primary, secondary, true)
}

/** The stored brand when there is one, else a record carrying the fallback pair (so a page reads `brand.pair` either way). */
export function brandOrFallback(real: OrgBrandRecord | null, key: string, kind = 'EMPLOYER'): OrgBrandRecord {
  return real ?? { kind, sourceId: key, siteUrl: null, pair: fallbackPair(key), candidates: [], source: 'SCAN', scannedAt: new Date(0) }
}
