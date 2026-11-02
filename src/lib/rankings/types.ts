// Shapes shared by the ranking engine, its stored snapshots and its pages. Pure types, no I/O.

/** One city's counts from the board scan. */
export interface CityStat {
  st: string
  city: string
  n: number
  entry: number
  ai: number
  remote: number
  paid: number
  payMed: number | null
  eng: number
  engPaid: number
  engPay: number | null
  /** Up to three employers with the most open roles here. */
  employers: string[]
  /** The biggest employer's share of the city's openings (0 to 1). */
  topShare: number
}

/** One county's jobs and population change from public data. */
export interface CountyStat {
  fips: string
  st: string
  name: string
  href: string | null
  population: number | null
  populationChangePct: number | null
  jobsThen: number
  jobsNow: number
  infoThen: number
  infoNow: number
}

export interface PlaceInfo { name: string; href: string | null }

export interface RankRow {
  rank: number
  key: string
  name: string
  /** Second line: the state, or the county's state. */
  sub: string
  href: string | null
  /** The number the list is ranked on. */
  value: number
  valueLabel: string
  stats: { label: string; value: string }[]
  employers: string[]
  /** Places up (+) or down (-) since last month's edition; null when there is no earlier edition or the place is new. */
  change: number | null
  /** The size of the sample behind the figure (openings for a city, jobs for a county). */
  n: number
}

export type MeasureId = 'junior' | 'ai' | 'paycost' | 'remote' | 'swe' | 'largest' | 'transparent' | 'growth' | 'infogrowth'

export interface RankingEdition {
  slug: string
  edition: string
  title: string
  h1: string
  measure: MeasureId
  family: string
  scope: { kind: 'national' | 'region' | 'state'; id: string; name: string }
  builtAt: string
  /** What a place needs to be ranked, in the measure's own unit ("openings" or "jobs"). */
  minN: number
  unit: 'openings' | 'jobs'
  placeNoun: 'cities' | 'counties'
  baseline: { label: string; valueLabel: string } | null
  lead: string
  keyFacts: string[]
  commentary: string[]
  faq: { q: string; a: string }[]
  method: string[]
  sources: string[]
  /** Titles of sibling lists, for the "also see" block. */
  rows: RankRow[]
}

export interface RankingIndexEntry {
  slug: string
  edition: string
  title: string
  family: string
  measure: MeasureId
  scopeKind: 'national' | 'region' | 'state'
  scopeId: string
  scopeName: string
  topName: string
  topValueLabel: string
  places: number
  /** Every edition built so far, newest first. */
  editions: string[]
}
