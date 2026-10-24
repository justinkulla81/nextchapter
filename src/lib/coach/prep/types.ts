// Session prep ("Before you meet <first name>"): the facts a loader gathers and the view the builder returns.
// Facts are plain data with no database types, so the builder is pure and tested without a database. A fact
// group that is null means "could not be read or not shared"; the builder turns that into an unavailable section,
// never a guess.

export type TraitFact = { key: string; label: string; level: 0 | 1 | 2 | 3; shownBy: string }

export interface EffortFacts {
  thisWeekMinutes: number
  lastWeekMinutes: number
  /** Days this week with search work logged, and the same for last week. */
  activeDaysThis: number
  activeDaysLast: number
  /** Whole days since the last message to a real person; null when there has never been one. */
  daysSinceOutreach: number | null
}

export interface PipelineFacts {
  applied: number
  replied: number
  interviews: number
  offers: number
  /** Titles of roles applied for. Roles are shown even when the member hides company names. */
  roles: string[]
  nextInterview: { at: Date; role: string | null; company: string | null } | null
  /** Interviews that appeared after the last session (or in the last 7 days when there was none). */
  newInterviews: number
}

export interface AgreedItem {
  owner: 'coach' | 'member'
  text: string
  status: 'open' | 'done'
  dueAt: Date | null
  /** Where this came from, so the page can say so: the follow-ups table or the earlier notes. */
  source: 'follow_up' | 'directive'
}

export interface MarketFacts {
  exposure: { title: string; score: number; band: 'high' | 'some' | 'little'; sentence: string; why: string; sourceName: string } | null
  pay: { occupationTitle: string; areaName: string; median: number | null; lastSalary: number | null } | null
  cycleLine: string | null
}

export interface PrepSessionFacts {
  startsAt: Date
  minutes: number
  meetUrl: string | null
  /** Which session this will be with this member (1 = first). */
  ordinal: number
  timezone: string
}

export interface PrepInput {
  now: Date
  firstName: string
  /** The member's all-or-nothing consent for their coach (coachDossierConsentedAt). Without it nothing about the search is read. */
  consented: boolean
  /** Confidential Search Mode: the coach sees counts and roles, never company names. */
  confidential: boolean
  weekNumber: number | null
  session: PrepSessionFacts | null
  lastSessionAt: Date | null
  effort: EffortFacts | null
  pipeline: PipelineFacts | null
  grade: { from: string; to: string } | null
  agreed: AgreedItem[] | null
  market: MarketFacts | null
  traits: TraitFact[] | null
}

export interface Stat {
  label: string
  value: string
  detail: string
}

export interface Change {
  dir: 'up' | 'down' | 'new'
  text: string
}

export interface Question {
  /** Which rule produced it, for tests and for the analytics event. */
  rule: string
  text: string
  /** One plain sentence on the data behind it. */
  reason: string
}

export interface MarketItem {
  headline: string
  body: string
  source: string
}

export interface SharedRow {
  label: string
  shared: boolean
  note?: string
}

export type Section<T> = { status: 'ok'; data: T } | { status: 'unavailable'; message: string }

export interface PrepView {
  title: string
  intro: string
  week: Section<{ stats: Stat[]; why: string; changesTitle: string; changes: Change[] }>
  agreed: Section<{ items: AgreedItem[]; why: string }>
  questions: Question[]
  market: Section<{ items: MarketItem[] }>
  strengths: Section<{ items: { label: string; level: string; body: string }[]; why: string }>
  shares: SharedRow[]
}
