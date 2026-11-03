import 'server-only'
import { readBoardFigure, writeBoardFigure } from '@/lib/jobs/stored-board-figures'
import { memoTtl } from '@/lib/db/heavy'
import { AWARD_BUCKETS, bucketEntries, bucketOf, mergeAwards, type Award, type AwardBook } from '@/lib/rankings/awards'
import { previousEdition } from '@/lib/rankings/store'
import type { SegmentEdition, SegmentIndexEntry } from '@/lib/segments/types'

// Editions are stored one row each, `segment:<slug>:<yyyy-mm>`; a rerun in the same month overwrites that month's row, so the
// last run of the month is what the archive keeps. The index row lists every segment's editions. Pages only read these rows.

export const readSegment = (slug: string, edition: string) => readBoardFigure<SegmentEdition>(`segment:${slug}:${edition}`)
export const writeSegment = (e: SegmentEdition) => writeBoardFigure(`segment:${e.slug}:${e.edition}`, e)
export const readSegmentIndex = async (): Promise<SegmentIndexEntry[]> => (await readBoardFigure<SegmentIndexEntry[]>('segment-index')) ?? []
export const writeSegmentIndex = (entries: SegmentIndexEntry[]) => writeBoardFigure('segment-index', entries)
export const readPreviousSegment = (slug: string, edition: string) => readSegment(slug, previousEdition(edition))

/** The newest edition of a segment, from the index, or null when none is built. */
export async function readLatestSegment(slug: string): Promise<SegmentEdition | null> {
  const entry = (await readSegmentIndex().catch(() => [])).find((x) => x.slug === slug)
  return entry?.editions[0] ? readSegment(slug, entry.editions[0]) : null
}

// ---- Employer placings: the top-25 employers of each list, every month, in AWARD_BUCKETS rows ----

const readBucket = (b: number) => readBoardFigure<AwardBook>(`segment-awards:${b}`)
const loadBucket = memoTtl(10 * 60_000, (b: number) => String(b), async (b: number): Promise<AwardBook> => (await readBucket(b)) ?? {})

/** An employer's placings (key `emp:<normalized name>`), every month kept. Empty when the book is missing or a read fails. */
export async function getSegmentAwards(keys: string[]): Promise<Award[]> {
  const unique = [...new Set(keys.filter(Boolean))]
  const books = await Promise.all([...new Set(unique.map(bucketOf))].map((b) => loadBucket(b).catch(() => ({} as AwardBook))))
  const merged: AwardBook = Object.assign({}, ...books)
  return unique.flatMap((k) => merged[k] ?? [])
}

export async function addToSegmentAwards(entries: [string, Award][]): Promise<void> {
  for (const [b, part] of bucketEntries(entries)) await writeBoardFigure(`segment-awards:${b}`, mergeAwards((await readBucket(b)) ?? {}, part))
}

export const SEGMENT_AWARD_BUCKETS = AWARD_BUCKETS
