import 'server-only'
import { readBoardFigure, writeBoardFigure } from '@/lib/jobs/stored-board-figures'
import { memoTtl } from '@/lib/db/heavy'
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

export const writePlaceRanks = (ranks: PlaceRanks) => writeBoardFigure('ranking-places', ranks)
const loadPlaceRanks = memoTtl(10 * 60_000, () => 'all', async (): Promise<PlaceRanks> => (await readBoardFigure<PlaceRanks>('ranking-places')) ?? {})
/** The lists a city (key "ST|placekey") or a county (FIPS) is in the top 25 of, best rank first. */
export async function getPlaceRanks(key: string): Promise<import('@/lib/rankings/types').PlaceRank[]> {
  return ((await loadPlaceRanks().catch(() => ({} as PlaceRanks)))[key] ?? []).slice(0, 6)
}
