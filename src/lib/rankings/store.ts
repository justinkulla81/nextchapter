import 'server-only'
import { readBoardFigure, writeBoardFigure } from '@/lib/jobs/stored-board-figures'
import type { RankingEdition, RankingIndexEntry } from '@/lib/rankings/types'

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
