// Entry-level numbers for the admin AI market page (entry-market-server.ts computes them into the daily
// AiMarketSnapshot). Pure and client-safe. Definitions: entry-filters.ts.

export interface EntryMarketRow {
  key: string
  /** Entry and early-career jobs in this group. */
  entry: number
  noExp: number
  entryAi: number
}

export interface EntryMarket {
  /** Live US jobs on the board, a role listed more than once counted once. */
  liveUs: number
  /** Of those, crawler level ENTRY_IC or EARLY_IC. */
  entry: number
  noExp: number
  entryAi: number
  /** entryAi where every AI ask says preferred / a plus (the rest ask for it as a requirement). */
  entryAiPreferred: number
  /** Top 10 by entry-level jobs. */
  byFunction: EntryMarketRow[]
  byIndustry: EntryMarketRow[]
  /** private / government / nonprofit / academia. */
  bySector: EntryMarketRow[]
}

/** "12.3%" of a whole; "—" for an empty whole. */
export function pctOf(n: number, whole: number): string {
  if (!whole) return '—'
  const p = (100 * n) / whole
  return `${p < 10 ? p.toFixed(1) : p.toFixed(0)}%`
}
