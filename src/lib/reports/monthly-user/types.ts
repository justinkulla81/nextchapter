// Shape of a stored monthly member report (MonthlyUserReport.data).
//
// The report is a list of sections, each a list of generic blocks, so the
// admin page, the CSV export and the email all render the same data without
// per-table code. Small cells are suppressed before anything is built into a
// block, so nothing in this structure — or the JSON stored from it — can
// identify a person.

export type Unit = 'count' | 'pct' | 'days' | 'score' | 'ratio'

export interface DistRow {
  label: string
  count: number
  /** % of `n` (members who answered), one decimal. */
  share: number
}

export interface Distribution {
  /** Members who have an answer for this question. */
  n: number
  /** Members with no answer. */
  unknown: number
  /** Only groups of at least MIN_CELL_SIZE members. */
  rows: DistRow[]
  /** How many groups were left out for being smaller than MIN_CELL_SIZE. */
  hiddenGroups: number
}

export interface StatRow {
  label: string
  value: number | null
  unit: Unit
  /** Same measure for the previous month, when one exists. */
  prior?: number | null
  note?: string
}

export interface ComparisonColumn {
  key: string
  label: string
  unit: Unit
}

export interface ComparisonRow {
  label: string
  n: number
  values: Record<string, number | null>
}

export interface RelationshipRow {
  a: string
  b: string
  /** Spearman rank correlation, -1 to 1. Null when too few members. */
  rho: number | null
  n: number
  strength: 'none' | 'weak' | 'moderate' | 'strong' | 'insufficient'
}

export type Block =
  | { kind: 'distribution'; title: string; note?: string; dist: Distribution }
  | { kind: 'stats'; title: string; note?: string; rows: StatRow[] }
  | { kind: 'comparison'; title: string; note?: string; columns: ComparisonColumn[]; rows: ComparisonRow[]; hiddenGroups: number }
  | { kind: 'relationships'; title: string; note?: string; rows: RelationshipRow[] }

export interface Section {
  id: string
  title: string
  /** One plain sentence on what this section answers. */
  intro: string
  blocks: Block[]
}

export interface Kpi {
  key: string
  label: string
  unit: Unit
  value: number | null
  prior: number | null
}

export interface Insight {
  tone: 'good' | 'watch' | 'info'
  title: string
  detail: string
  sectionId: string
}

export interface TrendPoint {
  monthKey: string
  label: string
  kpis: Record<string, number | null>
}

export interface MonthlyUserReportData {
  version: 1
  monthKey: string
  label: string
  periodStart: string
  periodEnd: string
  generatedAt: string
  minCellSize: number
  /** Registered, non-deactivated members as of the end of the month. */
  memberCount: number
  headline: Kpi[]
  insights: Insight[]
  sections: Section[]
  /** Oldest first, ending with this month. Filled from stored reports. */
  trend: TrendPoint[]
}
