/**
 * Private-sector employment and average annual pay by NAICS sector for a workforce board's area, 2015 to 2025 (BLS QCEW annual
 * averages; built by scripts/workforce/build-board-wage-history.py from the public annual files). The data file is about 1.1 MB, so
 * it is loaded on first use, not bundled into every page. A board's figure is the sum over its counties; `n` says how many of the
 * board's `counties` each year's figure rests on (BLS withholds some county-sector cells). Boards with no county list (Massachusetts,
 * some California city boards) and Connecticut (planning regions replaced counties) are not in the file.
 */
export interface BoardWageSeries {
  /** Average annual employment, one value per year in `years`; null when not reported. */
  e: (number | null)[]
  /** Average annual pay in dollars (total wages / employment). */
  p: (number | null)[]
  /** Counties the figure rests on, per year. */
  n: number[]
}
export interface BoardWageHistory {
  years: number[]
  sectors: Record<string, string>
  counties: number
  series: Record<string, BoardWageSeries>
}

let cache: Promise<{ years: number[]; sectors: Record<string, string>; boards: Record<string, { counties: number; s: Record<string, BoardWageSeries> }> }> | null = null
function load() {
  cache ??= import('./data/board-wage-history.json').then((m) => m.default as never)
  return cache
}

/** The board's sector series, or null when the board is not in the file. */
export async function boardWageHistory(boardId: string): Promise<BoardWageHistory | null> {
  const d = await load()
  const b = d.boards[boardId]
  return b ? { years: d.years, sectors: d.sectors, counties: b.counties, series: b.s } : null
}

/** Percent change in average annual pay between two years for a sector, or null if either is missing. */
export function payChangePct(s: BoardWageSeries, years: number[], from: number, to: number): number | null {
  const a = s.p[years.indexOf(from)], b = s.p[years.indexOf(to)]
  return a && b ? Math.round(((b - a) / a) * 1000) / 10 : null
}
