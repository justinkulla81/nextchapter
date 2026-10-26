// The quality bar for the industry, function, conference and association pages. A page is offered to search engines
// only when it carries enough of its own sourced information; below the bar it still renders for visitors but is
// noindex and out of the sitemap, and it flips to indexable by itself when the data arrives. Pure: no I/O.

/** One sourced fact on a page. `source` and `period` are what make a number citable. */
export interface Fact {
  key: string
  label: string
  value: string
  source: string
  period?: string
}

export const QUALITY_BAR = { facts: 5, links: 3 } as const

export interface Assessment { facts: number; links: number; indexable: boolean }

export function assess(facts: number, links: number, bar: { facts: number; links: number } = QUALITY_BAR): Assessment {
  return { facts, links, indexable: facts >= bar.facts && links >= bar.links }
}

/** Conference pages are judged on facts the conference row itself holds (the field snapshot is shared by every conference in an industry, so it does not count). */
export const CONFERENCE_BAR = { facts: 6, links: 3 } as const

export interface ConferenceFactInput {
  datesConfirmed: boolean
  startDate: Date | string | null
  typicalMonth: string | null
  format: string
  city: string | null
  state: string | null
  access: string
  costLow: number | null
  costHigh: number | null
  speaking: string
  speakingDeadline: Date | string | null
  organizer: string | null
  seniorities: string[]
  roles: string[]
  programFormats: string[]
  whyAttend: string | null
  cheaperWays: string | null
  verified: boolean
  checkedAt: Date | string | null
  industries: string[]
  functions: string[]
}

/** How many distinct facts of its own a conference row gives the page. */
export function conferenceFactCount(c: ConferenceFactInput): number {
  const checks = [
    (c.datesConfirmed && !!c.startDate) || !!c.typicalMonth,
    c.format === 'VIRTUAL' || !!c.city || !!c.state,
    c.costLow != null || c.costHigh != null || ['FREE', 'INVITE', 'APPLY'].includes(c.access),
    ['OPEN_CFP', 'BY_INVITE', 'NONE'].includes(c.speaking) || !!c.speakingDeadline,
    !!c.organizer,
    c.seniorities.length > 0 || c.roles.length > 0,
    c.programFormats.length > 0,
    (c.whyAttend?.length ?? 0) >= 40,
    !!c.cheaperWays,
    c.verified && !!c.checkedAt,
  ]
  return checks.filter(Boolean).length
}

/** Internal links the page will carry beyond its breadcrumb: its industries, functions, its organizer's page, and up to three related conferences. */
export function conferenceLinkCount(c: ConferenceFactInput, hasAssociationPage: boolean, relatedCount: number, placeLinks = 0): number {
  return c.industries.length + c.functions.length + (hasAssociationPage ? 1 : 0) + Math.min(3, relatedCount) + placeLinks
}

/** What the page holds beyond the catalog row: employers and named speakers read from the event's own pages. */
export interface ConferenceExtras { employers: number; speakers: number }

export function assessConference(c: ConferenceFactInput, hasAssociationPage: boolean, relatedCount: number, placeLinks = 0, extras: ConferenceExtras = { employers: 0, speakers: 0 }): Assessment {
  // A sourced employer list and a sourced speaker list are each a fact of their own; an employer list also gives the page links to employer pages.
  const facts = conferenceFactCount(c) + (extras.employers > 0 ? 1 : 0) + (extras.speakers > 0 ? 1 : 0)
  const links = conferenceLinkCount(c, hasAssociationPage, relatedCount, placeLinks) + (extras.employers > 0 ? 1 : 0)
  return assess(facts, links, CONFERENCE_BAR)
}

/**
 * Conferences an association needs before its page is offered to search engines. The audit found 28 of 30 sampled
 * pages with 2 or 3 conferences under 240 words; pages with more conferences carry more of their own text.
 */
export const ASSOCIATION_MIN_INDEXABLE_CONFERENCES = 4

/** An association page is judged on what its conferences give it, so the sitemap can decide from the catalog rows alone. */
export function assessAssociation(rows: ConferenceFactInput[]): Assessment {
  const industries = new Set(rows.flatMap((r) => r.industries))
  const functions = new Set(rows.flatMap((r) => r.functions))
  const now = Date.now()
  const checks = [
    rows.length >= 2,
    rows.some((r) => r.datesConfirmed && r.startDate && new Date(r.startDate).getTime() >= now - 86_400_000),
    rows.some((r) => r.costLow != null || r.costHigh != null || r.access === 'FREE'),
    rows.some((r) => !!r.city || !!r.state),
    rows.some((r) => ['OPEN_CFP', 'BY_INVITE', 'NONE'].includes(r.speaking)),
    industries.size > 0,
    rows.some((r) => r.seniorities.length > 0 || r.roles.length > 0),
  ]
  const a = assess(checks.filter(Boolean).length, industries.size + functions.size + Math.min(3, rows.length))
  return { ...a, indexable: a.indexable && rows.length >= ASSOCIATION_MIN_INDEXABLE_CONFERENCES }
}
