// Which events fit a member, best first. Pure and client-safe: the page loads the published rows and the
// member's facts, this decides the order and gives the one plain reason each row fits.
//
// Seniority comes from the member's calibrated level, which is internal and never shown. It only orders
// the list; the reason line names what the event is built for, not what the member is.

import { hasUpcomingDates } from './format'
import { SENIORITIES, SENIORITY_LABEL, type ConferenceRow, type Seniority } from './types'

export interface MemberEventFacts {
  /** Functions the member works in or wants to move into (PRIMARY_FUNCTION_OPTIONS). */
  functions: string[]
  /** Industry bucket names. */
  industries: string[]
  seniority: Seniority | null
  state: string | null
  journey: string | null
  /** Lower-cased job title text (latest title, target role) for matching an event's specific roles. */
  titleText: string
}

export interface EventFilters {
  function?: string
  industry?: string
  seniority?: Seniority
  /** Free text: matches name, organizer, roles, segments, industries. */
  q?: string
  /** 'cheap' = free, or a way to get in for less; 'speak' = a speaking path exists; 'invite' = apply or invitation. */
  way?: 'cheap' | 'speak' | 'invite'
}

export interface EventMatch {
  event: ConferenceRow
  score: number
  why: string
}

/** Member's internal level score (1-100) to a coarse band. Only used for ordering. */
export function seniorityFromScore(score: number | null | undefined): Seniority | null {
  if (score == null) return null
  if (score >= 70) return 'EXECUTIVE'
  if (score >= 55) return 'SENIOR'
  if (score >= 35) return 'MID'
  return 'EARLY'
}

const JOURNEY_PHRASE: Record<string, string> = { ENTREPRENEUR: 'starting or buying a business', FRACTIONAL: 'going fractional or independent', NEXT_ACT: 'in a next act', CAREER_CHANGE: 'changing careers', STUDENT_NEW_GRAD: 'starting out', RETURNING: 'returning to work', LAID_OFF: 'between jobs' }
const rank = (s: string) => SENIORITIES.indexOf(s as Seniority)

export function isCheapWay(e: ConferenceRow): boolean {
  return e.access === 'FREE' || e.access === 'MIXED' || !!e.cheaperWays
}
export const canSpeak = (e: ConferenceRow) => e.speaking === 'OPEN_CFP' || e.speaking === 'BY_INVITE' || e.speaking === 'LIKELY'
export const needsInvite = (e: ConferenceRow) => e.access === 'INVITE' || e.access === 'APPLY'

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9&+]+/).filter((w) => w.length > 2)
const STOP = new Set(['and', 'the', 'for', 'senior', 'junior', 'lead', 'head', 'manager', 'director', 'officer', 'specialist', 'analyst'])
/** An event role is hit when every distinctive word of it appears in the member's title text. */
function roleHits(e: ConferenceRow, titleText: string): string[] {
  if (!titleText) return []
  const have = new Set(words(titleText))
  return e.roles.filter((r) => {
    const ws = words(r).filter((w) => !STOP.has(w))
    return ws.length > 0 && ws.every((w) => have.has(w))
  })
}

function passes(e: ConferenceRow, f: EventFilters): boolean {
  if (f.q) {
    const hay = `${e.name} ${e.organizer ?? ''} ${e.roles.join(' ')} ${e.segments.join(' ')} ${e.industries.join(' ')} ${e.functions.join(' ')} ${e.city ?? ''}`.toLowerCase()
    if (!words(f.q).every((w) => hay.includes(w))) return false
  }
  if (f.function && e.functions.length > 0 && !e.functions.includes(f.function)) return false
  if (f.industry && e.industries.length > 0 && !e.industries.includes(f.industry)) return false
  if (f.seniority && e.seniorities.length > 0 && !e.seniorities.includes(f.seniority)) return false
  if (f.way === 'cheap' && !isCheapWay(e)) return false
  if (f.way === 'speak' && !canSpeak(e)) return false
  if (f.way === 'invite' && !needsInvite(e)) return false
  return true
}

const list = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, 2).join(', ')} and more`)

export function matchEvents(events: ConferenceRow[], facts: MemberEventFacts, filters: EventFilters = {}, now = new Date()): EventMatch[] {
  const out: EventMatch[] = []
  for (const e of events) {
    if (!e.published || !e.url) continue
    if (!passes(e, filters)) continue
    let score = 0
    const reasons: string[] = []

    const fnHit = e.functions.filter((f) => facts.functions.includes(f))
    const indHit = e.industries.filter((i) => facts.industries.includes(i))
    // An event with no function / industry tags is for everyone: a weak fit, never a strong one.
    if (fnHit.length) { score += 4; reasons.push(`${list(fnHit)} work`) }
    if (indHit.length) { score += 3; reasons.push(`the ${list(indHit)} industry`) }
    if (facts.journey && e.journeys.includes(facts.journey)) { score += 3; reasons.push(`people ${JOURNEY_PHRASE[facts.journey] ?? 'on your path'}`) }
    const roleHit = roleHits(e, facts.titleText)
    if (roleHit.length) { score += 4; reasons.unshift(`${list(roleHit)} roles`) }
    if (!e.functions.length && !e.industries.length && !e.roles.length) score += 1

    if (facts.seniority && e.seniorities.length) {
      const gap = Math.min(...e.seniorities.map((s) => Math.abs(rank(s) - rank(facts.seniority!))))
      if (gap === 0) score += 2
      else if (gap === 1) score += 0.5
      else score -= 2
    }
    if (e.seniorities.length && e.seniorities.length < 4) {
      const built = e.seniorities.map((s) => SENIORITY_LABEL[s as Seniority]?.toLowerCase()).filter(Boolean)
      if (built.length && reasons.length) reasons.push(`pitched at ${list(built)} people`)
    }

    score += e.importance === 1 ? 2 : e.importance === 2 ? 1 : 0
    if (facts.state && e.state === facts.state) { score += 1.5; reasons.push('in your state') }
    if (hasUpcomingDates(e, now)) score += 1
    if (e.verified) score += 0.5

    const why = reasons.length
      ? `Built for ${reasons.filter((r) => !r.startsWith('in your') && !r.startsWith('pitched')).join(' and ') || 'your field'}${reasons.includes('in your state') ? ', and it is in your state' : ''}.`
      : e.whyAttend ?? 'A broad event where many fields meet.'
    out.push({ event: e, score, why })
  }
  return out.sort((a, b) => b.score - a.score || (a.event.startDate?.getTime() ?? Infinity) - (b.event.startDate?.getTime() ?? Infinity) || a.event.name.localeCompare(b.event.name))
}
