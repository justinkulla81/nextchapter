import 'server-only'
import { cache } from 'react'
import { employerLinks } from '@/lib/rankings/employer-links'
import { isEdition } from '@/lib/rankings/store'
import { segmentBySlug, type SegmentDef } from '@/lib/segments/defs'
import { readSegment, readSegmentIndex } from '@/lib/segments/store'
import type { SegmentEdition, SegmentIndexEntry, SegmentRow } from '@/lib/segments/types'

export interface SegmentPageData { def: SegmentDef; entry: SegmentIndexEntry; e: SegmentEdition; newest: boolean }

/** A segment's stored edition (the newest, or the named month), or null when the segment is unknown or not built yet. Pages read, never scan. */
export const loadSegmentPage = cache(async (slug: string, edition?: string): Promise<SegmentPageData | null> => {
  const def = segmentBySlug(slug)
  if (!def) return null
  const entry = (await readSegmentIndex().catch(() => [])).find((x) => x.slug === slug)
  if (!entry?.editions.length) return null
  const want = edition && isEdition(edition) ? edition : entry.editions[0]
  if (!entry.editions.includes(want)) return null
  const e = await readSegment(slug, want).catch(() => null)
  return e ? { def, entry, e, newest: want === entry.editions[0] } : null
})

/** A known segment that has no published edition yet ("coming soon"), with the number of jobs found so far. */
export const loadSoonSegment = cache(async (slug: string): Promise<{ def: SegmentDef; found: number } | null> => {
  const def = segmentBySlug(slug)
  if (!def) return null
  const entry = (await readSegmentIndex().catch(() => [])).find((x) => x.slug === slug)
  return entry?.editions.length ? null : { def, found: entry?.total ?? 0 }
})

/** Employer pages for the employers in these rows (those with a page offered to search engines), by row key. */
export async function employerHrefs(rows: SegmentRow[]): Promise<Map<string, string>> {
  const byName = await employerLinks(rows.map((r) => r.name))
  const out = new Map<string, string>()
  for (const r of rows) { const h = byName.get(r.name); if (h) out.set(r.key, h) }
  return out
}

export { readSegmentIndex }
