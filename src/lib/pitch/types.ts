// A pitch deck is generated from a RuleSet: an ordered list of slide rules per
// customer type. Each rule can be switched on or off, reworded, or reordered in
// the admin tool; the generator only ever reads the rule set, so changing a
// rule changes every deck built after it.

export const CUSTOMER_TYPES = ['HIGHER_ED', 'ECON_DEV', 'CHAMBER', 'WIOA_BOARD', 'WORKFORCE_NONPROFIT', 'RECRUITER', 'OUTPLACEMENT_EMPLOYER'] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

export const CUSTOMER_LABELS: Record<CustomerType, string> = {
  HIGHER_ED: 'Colleges and universities',
  ECON_DEV: 'Economic development organizations',
  CHAMBER: 'Chambers of commerce',
  WIOA_BOARD: 'Workforce boards (WIOA)',
  WORKFORCE_NONPROFIT: 'Workforce nonprofits',
  RECRUITER: 'Recruiters and search firms',
  OUTPLACEMENT_EMPLOYER: 'Employers with layoffs',
}

/** What a slide shows. The generator knows how to draw each kind. */
export type SlideKind =
  | 'cover' | 'bullets' | 'stats' | 'table' | 'offer' | 'timeline' | 'people' | 'divider'
  | 'warn' | 'employers' | 'colleges' | 'datacenters' | 'board' | 'text' | 'news'
  | 'demo' | 'packages' | 'constituents'

export interface SlideRule {
  id: string
  section: 'Opening' | 'Data' | 'Problem' | 'Solution' | 'Offer' | 'Close' | 'Appendix'
  kind: SlideKind
  /** Shown in the admin tool and as the default slide heading. May hold {{tokens}}. */
  title: string
  /** One short line above the title. */
  kicker?: string
  /** One bullet per entry; may hold {{tokens}}. Ignored by data-only kinds. */
  bullets: string[]
  /** Switched off = left out of every deck of this type. */
  enabled: boolean
  /** Needs a local area's numbers; dropped automatically for a generic deck. */
  needsGeo?: boolean
  /** Which part of the deck it sits in. Appendix slides come after the main close. */
  appendix?: boolean
  /** Why it is in the deck, shown in the admin tool. */
  why?: string
  /** Set on a slide that speaks to one audience inside the customer (alumni, development, ...). */
  constituent?: string
}

export interface OfferTerms {
  name: string // "90-day alumni pilot"
  scope: string[] // what every package includes
  theyProvide: string[] // what we need from them to start
  term: string // "90 days"
  /** Optional. Intro decks leave it blank and show no price at all. */
  price: string
}

/** One way to buy. No price: an intro deck shows scope only. */
export interface Package {
  id: string
  name: string
  bestFor: string
  includes: string[]
}

export interface RuleSet {
  type: CustomerType
  label: string
  buyer: string
  angle: string
  tone: string
  ask: string
  offer: OfferTerms
  /** Who NextChapter suggests putting on the team slide for this audience. */
  suggestedPeople: string[]
  packages: Package[]
  /** Reminders shown as warnings on every deck of this type, e.g. features to confirm are live. */
  reviewNotes: string[]
  slides: SlideRule[]
}

export interface Brand {
  /** The prospect's name as it should appear on the cover. */
  orgName: string
  /** Data URL or https URL of the prospect's logo. Optional. */
  logo?: string
  primary: string // hex, "#2e7d5b"
  accent: string
}

export interface PersonCard {
  name: string
  title: string
  org: string // "NextChapter" or the prospect
  bio?: string
  side: 'us' | 'them'
}

export interface Fact { label: string; value: string; note?: string }

export interface DeckSlide {
  id: string
  section: SlideRule['section']
  kind: SlideKind
  kicker?: string
  title: string
  bullets: string[]
  facts?: Fact[]
  rows?: string[][]
  head?: string[]
  people?: PersonCard[]
  offer?: OfferTerms
  packages?: Package[]
  demo?: Demo
  /** Name of the audience, on slides that speak to one. */
  constituent?: string
  appendix?: boolean
}

/** A mock product screen drawn from editable shapes, always labeled as sample data. */
export interface Demo { frame: string; kpis: Fact[]; head: string[]; rows: string[][] }

export interface Deck {
  type: CustomerType
  generic: boolean
  title: string
  brand: Brand
  slides: DeckSlide[]
  /** Things Justin must fill in before sending (pricing, proof points, empty data). */
  warnings: string[]
  builtAt: string
}
