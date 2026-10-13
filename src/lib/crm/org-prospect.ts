import type { CrmDealStatus, CrmLeadQuality } from '@prisma/client'

// Overall prospect rating for a CRM organization — "how good a prospect is this
// organization for NextChapter to pursue right now". Pure scoring, no I/O, so
// every weight is unit-testable (src/test/org-prospect.test.ts); the Prisma
// loader is org-page-data.ts.
//
// Five components, 100 points together. Each returns points AND a plain-English
// reason when it earned any, so a rating is always explainable ("why a B?").
// Missing data is neutral — never a guess: an org we know nothing about scores
// low and says what is missing, it is not marked down for a fact we lack.
//
// This is deliberately separate from `leadQuality` (the hand-set grade): the
// grade is Justin's judgement and rarely moves; the rating is computed from
// live signals and moves on its own. The grade feeds one small component.

export interface ProspectInput {
  /** WARN notices + announcements in the last 18 months. */
  layoff: { notices: number; employees: number | null; daysSinceLatest: number | null; hiringAgain: boolean }
  /** Live postings on the board for this organization. */
  openRoles: number
  /** Of those, Director and above. */
  seniorRoles: number
  /** Candidates who put this organization on their watchlist / who applied. */
  candidatesWhoWant: number
  candidatesApplied: number
  candidatesWhoWorkedHere: number
  /** People in the CRM here. */
  contacts: number
  /** Contacts whose title is an HR / people / talent / executive decision maker. */
  decisionMakers: number
  routesIn: number
  meetings: number
  daysSinceLastTouch: number | null
  inTheNews: number
  leadQuality: CrmLeadQuality
  dealStatus: CrmDealStatus | null
  opportunities: number
}

export interface ProspectComponent {
  key: 'trigger' | 'hiring' | 'candidates' | 'reach' | 'standing'
  label: string
  points: number
  max: number
  reason: string | null
}

export type ProspectBand = 'hot' | 'warm' | 'cool' | 'cold'

export interface ProspectRating {
  score: number // 0-100
  band: ProspectBand
  /** 'A'..'D' to sit next to the hand-set grade without being confused with it. */
  letter: 'A' | 'B' | 'C' | 'D'
  components: ProspectComponent[]
  reasons: string[] // positive reasons, best first
  cautions: string[]
}

const MAX = { trigger: 30, hiring: 20, candidates: 15, reach: 20, standing: 15 } as const
// trigger 30 + hiring 20 + candidates 15 + reach 20 + standing 15 = 100

export const daysSince = (d: Date, now = Date.now()) => Math.max(0, Math.floor((now - d.getTime()) / 86_400_000))

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Titles that decide whether a workforce / outplacement / hiring product gets bought.
const DECISION_MAKER = /\b(chro|chief (people|human|talent)|human resources|\bhr\b|people|talent|workforce|learning|chief|ceo|coo|president|founder|vp|vice president|head of)\b/i
export function isDecisionMakerTitle(title: string | null | undefined): boolean {
  return !!title && DECISION_MAKER.test(title)
}

function trigger(i: ProspectInput): ProspectComponent {
  const { notices, employees, daysSinceLatest, hiringAgain } = i.layoff
  let points = 0
  let reason: string | null = null
  if (notices > 0 && daysSinceLatest !== null) {
    // Fresh layoffs are the strongest buying moment: displaced people exist now.
    points = daysSinceLatest <= 90 ? 24 : daysSinceLatest <= 270 ? 16 : 8
    if (employees && employees >= 1000) points += 6
    else if (employees && employees >= 100) points += 3
    // Already rehiring means the displaced-worker pitch is weaker, not gone.
    if (hiringAgain) points = Math.max(0, points - 4)
    reason = `${plural(notices, 'layoff notice')}${employees ? `, ${employees.toLocaleString()} roles` : ''}, latest ${daysSinceLatest} days ago`
  }
  return { key: 'trigger', label: 'Layoff trigger', points: Math.min(points, MAX.trigger), max: MAX.trigger, reason }
}

function hiring(i: ProspectInput): ProspectComponent {
  let points = 0
  if (i.openRoles > 0) points = i.openRoles >= 25 ? 16 : i.openRoles >= 10 ? 13 : i.openRoles >= 3 ? 10 : 6
  if (i.seniorRoles > 0) points += Math.min(4, 2 + i.seniorRoles)
  return {
    key: 'hiring',
    label: 'Open jobs',
    points: Math.min(points, MAX.hiring),
    max: MAX.hiring,
    reason: i.openRoles > 0
      ? `${plural(i.openRoles, 'open role')} on the board${i.seniorRoles ? `, ${i.seniorRoles} Director+` : ''}`
      : null,
  }
}

function candidates(i: ProspectInput): ProspectComponent {
  const interest = i.candidatesWhoWant + i.candidatesApplied
  let points = interest >= 10 ? 10 : interest >= 3 ? 7 : interest >= 1 ? 4 : 0
  if (i.candidatesWhoWorkedHere >= 3) points += 5
  else if (i.candidatesWhoWorkedHere >= 1) points += 2
  const parts: string[] = []
  if (i.candidatesWhoWant) parts.push(`${plural(i.candidatesWhoWant, 'candidate')} want to work here`)
  if (i.candidatesApplied) parts.push(`${i.candidatesApplied} applied`)
  if (i.candidatesWhoWorkedHere) parts.push(`${i.candidatesWhoWorkedHere} worked here`)
  return {
    key: 'candidates',
    label: 'Candidate pull',
    points: Math.min(points, MAX.candidates),
    max: MAX.candidates,
    reason: parts.length ? parts.join(', ') : null,
  }
}

function reach(i: ProspectInput): ProspectComponent {
  let points = 0
  const parts: string[] = []
  if (i.contacts > 0) { points += 6; parts.push(plural(i.contacts, 'contact')) }
  if (i.decisionMakers > 0) { points += 7; parts.push(`${plural(i.decisionMakers, 'decision maker')}`) }
  if (i.routesIn > 0) { points += 4; parts.push(`${plural(i.routesIn, 'route')} in`) }
  if (i.meetings > 0) { points += 3; parts.push(`${plural(i.meetings, 'meeting')} held`) }
  return {
    key: 'reach',
    label: 'Reach',
    points: Math.min(points, MAX.reach),
    max: MAX.reach,
    reason: parts.length ? parts.join(', ') : null,
  }
}

const QUALITY_POINTS: Record<CrmLeadQuality, number> = { A: 8, B: 6, C: 3, D: 0, UNGRADED: 2 }
const DEAL_POINTS: Partial<Record<CrmDealStatus, number>> = {
  CONTACTED: 2, IN_CONVERSATION: 4, PROPOSAL: 5, PILOT: 6, CUSTOMER: 7, PROSPECT: 1,
}

function standing(i: ProspectInput): ProspectComponent {
  let points = QUALITY_POINTS[i.leadQuality]
  const parts: string[] = []
  if (i.leadQuality === 'A' || i.leadQuality === 'B') parts.push(`graded ${i.leadQuality}`)
  if (i.dealStatus && (DEAL_POINTS[i.dealStatus] ?? 0) > 0) {
    points += DEAL_POINTS[i.dealStatus]!
    parts.push(i.dealStatus.toLowerCase().replace(/_/g, ' '))
  }
  if (i.inTheNews > 0) { points += 1; parts.push('in the news') }
  return {
    key: 'standing',
    label: 'Standing',
    points: Math.min(points, MAX.standing),
    max: MAX.standing,
    reason: parts.length ? parts.join(', ') : null,
  }
}

export function rateProspect(input: ProspectInput): ProspectRating {
  const components = [trigger(input), hiring(input), candidates(input), reach(input), standing(input)]
  const score = components.reduce((s, c) => s + c.points, 0)

  const cautions: string[] = []
  if (input.dealStatus === 'LOST') cautions.push('Marked lost')
  if (input.dealStatus === 'ON_HOLD') cautions.push('On hold')
  if (input.leadQuality === 'D') cautions.push('Graded D — poor fit')
  if (input.contacts === 0) cautions.push('No one in the CRM here yet')
  else if (input.decisionMakers === 0) cautions.push('No HR / people / executive contact yet')
  if (input.daysSinceLastTouch !== null && input.daysSinceLastTouch > 90) cautions.push(`Not contacted in ${input.daysSinceLastTouch} days`)
  if (input.layoff.hiringAgain) cautions.push('Already hiring again after its layoff')

  // A lost or poor-fit org can still show strong signals; the band must not
  // read "hot" for something we have decided against.
  const dead = input.dealStatus === 'LOST' || input.leadQuality === 'D'
  const band: ProspectBand = dead ? 'cold' : score >= 60 ? 'hot' : score >= 40 ? 'warm' : score >= 20 ? 'cool' : 'cold'
  const letter = band === 'hot' ? 'A' : band === 'warm' ? 'B' : band === 'cool' ? 'C' : 'D'

  return {
    score,
    band,
    letter,
    components,
    reasons: [...components].filter((c) => c.points > 0 && c.reason).sort((a, b) => b.points - a.points).map((c) => c.reason!),
    cautions,
  }
}
