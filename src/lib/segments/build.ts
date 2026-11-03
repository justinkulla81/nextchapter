import 'server-only'
import { buildEdition, prevFrom, publishedCuts } from '@/lib/segments/aggregate'
import { MIN_SEGMENT_JOBS, SEGMENTS, segmentsOf } from '@/lib/segments/defs'
import { scanBoard } from '@/lib/segments/scan'
import { addToSegmentAwards, readPreviousSegment, readSegmentIndex, writeSegment, writeSegmentIndex } from '@/lib/segments/store'
import type { Award } from '@/lib/rankings/awards'
import type { BoardRow, CutId, SegmentIndexEntry } from '@/lib/segments/types'

/** The cuts whose rows are employers: the ones that earn a placing on the employer's own page. */
export const AWARD_CUTS: CutId[] = ['top-employers', 'highest-paying-employers', 'entry-level']

export const currentEdition = (now = new Date()) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

export interface SegmentBuildResult { edition: string; scanned: number; built: { slug: string; total: number; cuts: number }[]; skipped: { slug: string; total: number }[] }

/**
 * Reads the live board once, sorts every posting into its segments, and stores this month's edition of each segment that has
 * enough jobs. A rerun in the same month overwrites that month's edition. Segments below the bar are not stored (their pages
 * say so), and the placings for each edition are added to the awards book that employer pages read.
 */
export async function buildSegments(now = new Date()): Promise<SegmentBuildResult> {
  const edition = currentEdition(now)
  const bySlug = new Map<string, BoardRow[]>(SEGMENTS.map((s) => [s.slug, []]))
  const scanned = await scanBoard((rows) => {
    for (const r of rows) for (const slug of segmentsOf(r)) bySlug.get(slug)!.push(r)
  })
  const built: SegmentBuildResult['built'] = []
  const skipped: SegmentBuildResult['skipped'] = []
  const awards: [string, Award][] = []
  const old = await readSegmentIndex().catch(() => [] as SegmentIndexEntry[])
  const index = new Map(old.map((x) => [x.slug, x]))
  for (const def of SEGMENTS) {
    const rows = bySlug.get(def.slug)!
    if (rows.length < MIN_SEGMENT_JOBS) { skipped.push({ slug: def.slug, total: rows.length }); continue }
    const prev = prevFrom(await readPreviousSegment(def.slug, edition).catch(() => null))
    const e = buildEdition(def.slug, edition, rows, prev, now)
    await writeSegment(e)
    const cuts = publishedCuts(e)
    index.set(def.slug, {
      slug: def.slug, name: def.name, total: e.total, payMed: e.payMed, cuts,
      editions: [...new Set([edition, ...(index.get(def.slug)?.editions ?? [])])].sort().reverse(),
    })
    for (const cut of AWARD_CUTS) {
      const list = e.cuts[cut] ?? []
      for (const r of list) awards.push([`emp:${r.key}`, { slug: `${def.slug}/${cut}`, edition, rank: r.rank, valueLabel: r.valueLabel, places: list.length }])
    }
    built.push({ slug: def.slug, total: e.total, cuts: cuts.length })
  }
  await writeSegmentIndex([...index.values()].sort((a, b) => b.total - a.total))
  await addToSegmentAwards(awards)
  return { edition, scanned, built, skipped }
}
