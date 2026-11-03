// Shapes shared by the segment build, its stored editions and its pages. Pure types, no I/O.

/** One live board posting, only the columns a segment list needs. */
export interface BoardRow {
  id: string
  title: string
  company: string
  companyId: string | null
  st: string | null
  city: string | null
  level: string | null
  payMin: number | null
  payMax: number | null
  payPeriod: string | null
  currency: string | null
  postedAt: string | null
  createdAt: string
  industry: string | null
  reqTags: string | null
  /** 'direct' or 'recruiter_search': a search firm's posting is not the employer's own. */
  postingType: string | null
  /** 'search_firm' when a search firm runs the board the posting came from. */
  sourceCategory: string | null
  skills: string[]
  noExperience: boolean
  soc: string | null
}

export type CutId =
  | 'top-employers' | 'top-roles' | 'top-states' | 'top-cities'
  | 'highest-paying-roles' | 'highest-paying-employers' | 'top-skills'
  | 'newest' | 'entry-level'

export interface SegmentRow {
  rank: number
  /** Stable key: the normalized employer name for an employer, the label for everything else. */
  key: string
  name: string
  /** Second line (a state, the pay range or the biggest city). */
  sub: string
  /** The number the list is ranked on, and how it reads. */
  value: number
  valueLabel: string
  /** Extra figures shown beside the value. */
  stats: { label: string; value: string }[]
  /** Places up (+) or down (-) since last month's edition; null when there is none or the entry is new. */
  change: number | null
  /** Bar length, 0 to 1. */
  bar: number
}

export interface SegmentJob { id: string; title: string; company: string; location: string | null; pay: string | null; postedAt: string }

export interface SegmentEdition {
  slug: string
  edition: string
  builtAt: string
  /** Open verified jobs in the segment, those that state yearly pay in dollars, and their median. */
  total: number
  paid: number
  payMed: number | null
  employers: number
  prev: { edition: string; total: number; payMed: number | null } | null
  cuts: Partial<Record<CutId, SegmentRow[]>>
  newest: SegmentJob[]
  entry: { total: number; jobs: SegmentJob[] }
}

export interface SegmentIndexEntry {
  slug: string
  name: string
  total: number
  payMed: number | null
  /** Every edition built so far, newest first. */
  editions: string[]
  /** Which cuts have enough data to publish in the newest edition. */
  cuts: CutId[]
}
