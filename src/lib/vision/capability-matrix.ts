/**
 * Pure helpers behind the capability matrix page: freshness, status vocabulary, the summary strip and which
 * competitors to show by default. No database and no clock reads except through the `now` argument, so they can be tested.
 */
import { CAPABILITIES, type Capability } from './capabilities'

export const STALE_DAYS = 90
export const MAX_COLUMNS = 12

export const CELL_STATUSES = ['YES', 'PARTIAL', 'NO', 'UNKNOWN'] as const
export type CellStatus = (typeof CELL_STATUSES)[number]

export const CELL_LABEL: Record<CellStatus, string> = { YES: 'Yes', PARTIAL: 'Partial', NO: 'No', UNKNOWN: 'Unknown' }

export const isCellStatus = (v: unknown): v is CellStatus => CELL_STATUSES.includes(v as CellStatus)

/** A cell is stale when it was never checked, or last checked more than STALE_DAYS ago. */
export function isStale(checkedAt: Date | string | null | undefined, now: Date = new Date(), days = STALE_DAYS): boolean {
  if (!checkedAt) return true
  const t = checkedAt instanceof Date ? checkedAt.getTime() : Date.parse(checkedAt)
  if (Number.isNaN(t)) return true
  return now.getTime() - t > days * 86_400_000
}

/** A cell counts as filled when someone has answered it: anything but UNKNOWN. */
export const isFilled = (c: { status: CellStatus }) => c.status !== 'UNKNOWN'

export interface CompetitorSummary {
  filled: number
  total: number
  /** Share (0 to 100) of OUR built capabilities in view that the competitor is recorded as having (YES or PARTIAL). Null when none of ours is built. */
  coveragePct: number | null
  oldestCheckedAt: Date | null
  /** True when some filled cell has no checked date. */
  anyUnchecked: boolean
}

/**
 * The summary strip for one competitor over the capabilities shown.
 * coverage = our BUILT capabilities where they are YES or PARTIAL / our BUILT capabilities.
 * Unknown counts as not covered here, which is why the filled count is shown beside it.
 */
export function summarize(
  caps: Pick<Capability, 'key' | 'ours'>[],
  cells: Map<string, { status: CellStatus; checkedAt: Date | null }>,
): CompetitorSummary {
  let filled = 0
  let covered = 0
  let built = 0
  let oldest: Date | null = null
  let anyUnchecked = false
  for (const cap of caps) {
    const cell = cells.get(cap.key)
    const status = cell?.status ?? 'UNKNOWN'
    if (cap.ours === 'BUILT') {
      built++
      if (status === 'YES' || status === 'PARTIAL') covered++
    }
    if (status !== 'UNKNOWN') {
      filled++
      if (!cell?.checkedAt) anyUnchecked = true
      else if (!oldest || cell.checkedAt < oldest) oldest = cell.checkedAt
    }
  }
  return { filled, total: caps.length, coveragePct: built ? Math.round((covered / built) * 100) : null, oldestCheckedAt: oldest, anyUnchecked }
}

export interface ColumnCandidate { id: string; name: string; relationship: string; filled: number }

const REL_RANK: Record<string, number> = { DIRECT: 0, ADJACENT: 1 }

/** Default columns: DIRECT before ADJACENT, then most filled cells first, then name; capped. Partners and suppliers only by hand. */
export function defaultColumns<T extends ColumnCandidate>(list: T[], max = MAX_COLUMNS): T[] {
  return list
    .filter((c) => c.relationship in REL_RANK)
    .sort((a, b) => REL_RANK[a.relationship] - REL_RANK[b.relationship] || b.filled - a.filled || a.name.localeCompare(b.name))
    .slice(0, max)
}

/** Parses the `cols` query value (comma separated ids), keeping only known ids, in the order given, capped. */
export function parseColumnIds(raw: string | undefined, known: Set<string>, max = MAX_COLUMNS): string[] {
  if (!raw) return []
  return [...new Set(raw.split(',').map((x) => x.trim()).filter((x) => known.has(x)))].slice(0, max)
}

export const catalogIn = (area: string): Capability[] => CAPABILITIES.filter((c) => c.area === area)

/** True when a database error means the capability tables have not been created yet (the SQL is applied separately). */
export function looksLikeMissingTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  if (err.code === 'P2021' || err.code === 'P2022') return true
  return /does not exist/i.test(String(err.message ?? ''))
}

/** "https://…" only, trimmed; undefined for anything else (http, javascript:, bare words). */
export function cleanHttpsUrl(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : undefined
  } catch { return undefined }
}
