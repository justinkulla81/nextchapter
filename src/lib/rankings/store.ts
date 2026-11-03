import 'server-only'
import { readBoardFigure, writeBoardFigure } from '@/lib/jobs/stored-board-figures'
import { memoTtl } from '@/lib/db/heavy'
import { AWARD_BUCKETS, awardEntries, bucketEntries, bucketOf, mergeAwards, type Award, type AwardBook } from '@/lib/rankings/awards'
import type { PlaceRanks, RankingEdition, RankingIndexEntry } from '@/lib/rankings/types'

// Editions are stored one row each, `ranking:<slug>:<yyyy-mm>`, and never change after the month ends. The index row lists
// the newest edition of every list. Pages read these rows; none runs a scan.

export const readRanking = (slug: string, edition: string) => readBoardFigure<RankingEdition>(`ranking:${slug}:${edition}`)
export const writeRanking = (e: RankingEdition) => writeBoardFigure(`ranking:${e.slug}:${e.edition}`, e)
export const readRankingIndex = async (): Promise<RankingIndexEntry[]> => (await readBoardFigure<RankingIndexEntry[]>('ranking-index')) ?? []
export const writeRankingIndex = (entries: RankingIndexEntry[]) => writeBoardFigure('ranking-index', entries)

export const previousEdition = (edition: string) => {
  const [y, m] = edition.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const isEdition = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

export const readPlaceRanksRaw = async (): Promise<PlaceRanks> => (await readBoardFigure<PlaceRanks>('ranking-places')) ?? {}
export const writePlaceRanks = (ranks: PlaceRanks) => writeBoardFigure('ranking-places', ranks)
const loadPlaceRanks = memoTtl(10 * 60_000, () => 'all', async (): Promise<PlaceRanks> => (await readBoardFigure<PlaceRanks>('ranking-places')) ?? {})
/** The lists a city (key "ST|placekey") or a county (FIPS) is in the top 25 of, best rank first. */
export async function getPlaceRanks(key: string): Promise<import('@/lib/rankings/types').PlaceRank[]> {
  return ((await loadPlaceRanks().catch(() => ({} as PlaceRanks)))[key] ?? []).slice(0, 6)
}

// ---- Awards: every month's placings, in AWARD_BUCKETS rows so a page reads one small row ----

const readBucket = (b: number) => readBoardFigure<AwardBook>(`ranking-awards:${b}`)
const loadBucket = memoTtl(10 * 60_000, (b: number) => String(b), async (b: number): Promise<AwardBook> => (await readBucket(b)) ?? {})

/** The awards for any of these entity keys (a city "ST|city", a county FIPS), every month kept. Empty when the book is missing or a read fails. */
export async function getAwards(keys: string[]): Promise<Award[]> {
  const unique = [...new Set(keys.filter(Boolean))]
  const books = await Promise.all([...new Set(unique.map(bucketOf))].map((b) => loadBucket(b).catch(() => ({} as AwardBook))))
  const merged: AwardBook = Object.assign({}, ...books)
  const seen = new Set<string>()
  const out: Award[] = []
  for (const k of unique) for (const a of merged[k] ?? []) {
    const id = `${a.slug}|${a.edition}`
    if (!seen.has(id)) { seen.add(id); out.push(a) }
  }
  return out
}

/** Adds entries to the stored book, bucket by bucket. */
export async function addToAwardBook(entries: [string, Award][]): Promise<void> {
  for (const [b, part] of bucketEntries(entries)) {
    await writeBoardFigure(`ranking-awards:${b}`, mergeAwards((await readBucket(b)) ?? {}, part))
  }
}

/**
 * Rebuilds the whole book from the stored editions (every list, every month in the index). Used for the first build after this
 * shipped, so months that were already published get their awards, and by hand (/api/cron/rankings?group=awards).
 */
export async function rebuildAwardBook(): Promise<{ editions: number; awards: number }> {
  const index = await readRankingIndex()
  let editions = 0
  const entries: [string, Award][] = []
  for (const x of index) {
    for (const ed of x.editions) {
      const e = await readRanking(x.slug, ed).catch(() => null)
      if (!e) continue
      editions++
      entries.push(...awardEntries(e))
    }
  }
  const parts = bucketEntries(entries)
  for (let b = 0; b < AWARD_BUCKETS; b++) await writeBoardFigure(`ranking-awards:${b}`, mergeAwards({}, parts.get(b) ?? []))
  return { editions, awards: entries.length }
}

/** Whether the book has ever been written. */
export const awardBookExists = async () => (await readBucket(0)) !== null
