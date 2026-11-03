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
  /** Mid-career (mid-level, senior and manager) and director-and-above openings. */
  mid: number
  exec: number
  /** For a job-family slice only: the city's openings across every family. */
  cityN?: number
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
  /** Unemployment (BLS LAUS, not seasonally adjusted): the rate now and a year ago, in percent, and the labor force. */
  rate?: number | null
  rateYearAgo?: number | null
  laborForce?: number | null
  /** Share of workers in white-collar occupations (Census ACS), 0 to 1, and the county's median household income. */
  whiteCollarShare?: number | null
  medianIncome?: number | null
  /** Share of private jobs in AI-exposed sectors, 0 to 1, and the biggest such sector. */
  exposedShare?: number | null
  exposedTop?: string | null
  /** Our open professional roles in the county, the unemployed people there, and its American Job Centers. */
  openings?: number | null
  unemployed?: number | null
  ajc?: number | null
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
  /** Bar length for the chart, 0 to 1, so lists ranked lowest-first still show the leader with the longest bar. */
  bar?: number
}

export type MeasureId =
  | 'junior' | 'ai' | 'paycost' | 'remote' | 'swe' | 'largest' | 'transparent' | 'growth' | 'infogrowth'
  | 'midcareer' | 'leadership' | 'fnopen' | 'fnpay' | 'aiskills' | 'aitools' | 'aicerts' | 'skillpay'
  | 'lowunemp' | 'unempdrop' | 'whitecollar' | 'aiexposed' | 'collegepay'
  | 'indjunior' | 'indai' | 'indpay'
  | 'icopen' | 'icpay' | 'cgrad' | 'cmid' | 'cremote' | 'cai' | 'perunemp' | 'claidoff' | 'coverall'

/** The measures a single city is ranked on by one value. Composite lists score a whole pool at once and are not in this set. */
export type CityMeasureId = 'junior' | 'ai' | 'paycost' | 'remote' | 'swe' | 'largest' | 'transparent' | 'midcareer' | 'leadership' | 'fnopen' | 'fnpay' | 'icopen' | 'icpay'

/** Which stored build a list belongs to: the three builds run as separate monthly jobs so each stays inside the time limit. */
export type BuildGroup = 'places' | 'functions' | 'skills' | 'workforce' | 'college' | 'industry'

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
  unit: 'openings' | 'jobs' | 'students'
  placeNoun: 'cities' | 'counties' | 'skills' | 'tools' | 'certifications' | 'colleges' | 'industries'
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
  group?: BuildGroup
  /** Every edition built so far, newest first. */
  editions: string[]
}

/** Where a place ranks: one entry per list it is in the top 25 of, for the rank line on its page. */
export interface PlaceRank { slug: string; title: string; rank: number; valueLabel: string; places: number }
export type PlaceRanks = Record<string, PlaceRank[]>

/** Openings in one industry bucket, with the counts the industry lists rank on. */
export interface IndustryStat { name: string; n: number; entry: number; ai: number; paid: number; payMed: number | null }

/** One AI skill, tool or certification named in postings, in one job family (fn "*" is every family). */
export interface SkillStat { fn: string; kind: 'skill' | 'tool' | 'cert'; key: string; n: number; paid: number; payMed: number | null }
/** Openings in a job family (fn "*" is every family), with their median posted pay. */
export interface FnTotal { fn: string; n: number; paid: number; payMed: number | null }

/** One college's published outcomes (College Scorecard, via our college tables). */
export interface CollegeStat {
  unitid: string
  name: string
  st: string
  href: string | null
  control: string | null
  level: string | null
  enrollment: number
  earnings10: number
  completionRate: number | null
  netPrice: number | null
}

/** Openings and median posted pay in one industry in one city. */
export interface IndustryCityRow { st: string; city: string; industry: string; n: number; paid: number; payMed: number | null }
