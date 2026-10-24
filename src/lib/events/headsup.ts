// The runway to an event: what a member should do, and when, starting months out. Pure and client-safe.
// The cron picks the due stage per member and event; the page shows the same next step and the drafts.
//
//   EXPLORE       ~9 to 6 months out   ask the organizer about speaking, a panel or a sponsor slot; read last year's agenda
//   SPEAK_30/7    30 and 7 days before the speaker deadline
//   DECIDE        ~4 to 3 months out   decide whether to attend, while early pricing lasts
//   BOOK          ~2.5 to 2 months out (going) book the ticket, flights and hotel before prices climb
//   NETWORK_PREP  ~30 to 21 days out (going) write the people you want to meet before the show
//   FINAL         ~7 days out (going)  plan the days, message the top meetings once more
//
// EXPLORE also runs on the usual month when the next dates are not announced: speaking asks need the earliest lead.

import { hasUpcomingDates } from './format'
import type { ConferenceRow } from './types'

export const STAGES = ['EXPLORE', 'SPEAK_30', 'SPEAK_7', 'DECIDE', 'BOOK', 'NETWORK_PREP', 'FINAL', 'CHECK_IN', 'NEXT_EDITION'] as const
export type Stage = (typeof STAGES)[number]
export type InterestStatus = 'SAVED' | 'GOING' | 'SPEAKING' | 'FOLLOWING' | null

/** Most urgent first. SPEAK_7 and FINAL are time-critical and ignore the weekly email cap. */
export const STAGE_PRIORITY: Stage[] = ['SPEAK_7', 'FINAL', 'NEXT_EDITION', 'SPEAK_30', 'NETWORK_PREP', 'BOOK', 'DECIDE', 'CHECK_IN', 'EXPLORE']
export const URGENT_STAGES: Stage[] = ['SPEAK_7', 'FINAL']

const DAY = 86_400_000
const daysUntil = (d: Date, now: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY)
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** Confirmed start date, else the middle of the next usual month, else null. */
export function approxStart(e: Pick<ConferenceRow, 'datesConfirmed' | 'startDate' | 'endDate' | 'typicalMonth'>, now = new Date()): { date: Date; confirmed: boolean } | null {
  if (hasUpcomingDates(e, now) && e.startDate) return { date: e.startDate, confirmed: true }
  const m = e.typicalMonth ? MONTHS.indexOf(e.typicalMonth.trim().toLowerCase()) : -1
  if (m < 0) return null
  let d = new Date(Date.UTC(now.getUTCFullYear(), m, 15))
  if (d <= now) d = new Date(Date.UTC(now.getUTCFullYear() + 1, m, 15))
  return { date: d, confirmed: false }
}

export type Outcome = 'ATTENDED' | 'SPOKE' | 'DID_NOT_GO'
export const OUTCOMES: Outcome[] = ['ATTENDED', 'SPOKE', 'DID_NOT_GO']

export interface InterestRow { status: string; editionEnd: Date | null; outcome: string | null }

/** Year of the edition we are counting down to, so a stage can fire again for next year's event. */
export function editionKey(e: Pick<ConferenceRow, 'datesConfirmed' | 'startDate' | 'endDate' | 'typicalMonth'>, now = new Date()): string {
  const s = approxStart(e, now)
  return s ? String(s.date.getUTCFullYear()) : ''
}

/** The edition has ended 2 to 60 days ago and the member has not said how it went. */
export function checkInDue(i: InterestRow, now = new Date()): boolean {
  if (i.outcome || !i.editionEnd || i.status === 'FOLLOWING') return false
  const since = (now.getTime() - i.editionEnd.getTime()) / DAY
  return since >= 2 && since <= 60
}

/** Next year's dates are out: the event holds a confirmed upcoming edition that starts after the one the member knew. */
export function nextEditionDue(e: ConferenceRow, i: InterestRow, now = new Date()): boolean {
  if (!hasUpcomingDates(e, now) || !e.startDate) return false
  const wasThere = i.outcome === 'ATTENDED' || i.outcome === 'SPOKE'
  if (!wasThere && i.status !== 'FOLLOWING') return false
  return !i.editionEnd || e.startDate.getTime() > i.editionEnd.getTime()
}

/** Stages that are due today for this event and member. A stage is due inside its window; the log stops repeats. */
export function dueStages(e: ConferenceRow, interest: InterestStatus, now = new Date()): Stage[] {
  const out: Stage[] = []
  const going = interest === 'GOING' || interest === 'SPEAKING'
  const start = approxStart(e, now)
  if (start) {
    const d = daysUntil(start.date, now)
    if (d <= 270 && d >= 180) out.push('EXPLORE')
    if (start.confirmed) {
      if (d <= 120 && d >= 90 && !going) out.push('DECIDE')
      if (d <= 75 && d >= 60 && going) out.push('BOOK')
      if (d <= 30 && d >= 21 && going) out.push('NETWORK_PREP')
      if (d <= 7 && d >= 2 && going) out.push('FINAL')
    }
  }
  if (e.speaking === 'OPEN_CFP' && e.speakingDeadline && interest) {
    const s = daysUntil(e.speakingDeadline, now)
    if (s <= 30 && s >= 15) out.push('SPEAK_30')
    if (s <= 7 && s >= 1) out.push('SPEAK_7')
  }
  return out
}

/** One plain line for the page: the next thing to do for this event, or null. */
export function nextStep(e: ConferenceRow, interest: InterestStatus, now = new Date()): string | null {
  if (e.speaking === 'OPEN_CFP' && e.speakingDeadline && e.speakingDeadline >= now && interest) {
    return `Speaker proposals close ${e.speakingDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}. Decide this week whether to submit.`
  }
  if (!hasUpcomingDates(e, now) || !e.startDate) return interest ? 'Dates are not announced yet. We will tell you when they are, and what to do first.' : null
  const d = daysUntil(e.startDate, now)
  if (d > 180) return 'Too early to book. Read last year’s agenda and note the speakers you would want to meet.'
  if (d > 90) return 'Now is the time to read the agenda and panels, and to write the organizer about speaking.'
  if (d > 30) return interest === 'GOING' ? 'Book travel and early pricing, then list the ten people you want to meet.' : 'Decide whether to go while early pricing lasts.'
  if (d > 7) return interest === 'GOING' ? 'Write the people you want to meet before the show. Drafts are below.' : null
  if (d >= 0) return interest === 'GOING' ? 'This week: plan each day and message your top three meetings.' : null
  return null
}

export interface DraftContext {
  firstName: string | null
  /** Short description of who they are, e.g. "a claims leader at a regional insurer". May be empty. */
  about?: string
}

const hello = (n: string | null) => (n ? `Hi,` : 'Hi,')
const sign = (n: string | null) => `Thank you,\n${n ?? ''}`.trim()

/** Draft to the organizer: ask about speaking or the program. The member edits and sends it; we send nothing for them. */
export function organizerDraft(e: ConferenceRow, ctx: DraftContext): { subject: string; body: string } {
  const speak = e.speaking === 'OPEN_CFP'
    ? `I saw the call for speakers${e.speakingDeadline ? ` closes ${e.speakingDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}` : ''}. I would like to propose a session`
    : e.speaking === 'BY_INVITE' || e.speaking === 'LIKELY'
      ? 'I understand the program team selects speakers. I would like to be considered for a session or a panel'
      : 'I would like to take part in the program, as a speaker or a panelist if there is room'
  return {
    subject: `${e.name}: a speaking idea${ctx.about ? ` from ${ctx.about}` : ''}`,
    body: `${hello(ctx.firstName)}\n\n${speak} on what I have learned ${ctx.about ? `as ${ctx.about}` : 'in my work'}. I can send a one-paragraph outline and two titles to choose from. Who is the right person to talk to about the program, and is there a format that fits best?\n\n${sign(ctx.firstName)}`,
  }
}

/** Draft to a person the member wants to meet at the event. */
export function networkingDraft(e: ConferenceRow, ctx: DraftContext): { subject: string; body: string } {
  const when = e.startDate && hasUpcomingDates(e) ? e.startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }) : null
  return {
    subject: `Meeting at ${e.name}${when ? ` on ${when}` : ''}?`,
    body: `${hello(ctx.firstName)}\n\nI am going to ${e.name}${when ? ` on ${when}` : ''}${ctx.about ? ` and I am ${ctx.about}` : ''}. I would like to hear how you are approaching your work and see whether we can help each other. Do you have 20 minutes for coffee one day of the event? I can work around your schedule.\n\n${sign(ctx.firstName)}`,
  }
}

export const STAGE_SUBJECT: Record<Stage, (name: string) => string> = {
  EXPLORE: (n) => `${n}: ask now about speaking or a panel`,
  CHECK_IN: (n) => `How was ${n}?`,
  NEXT_EDITION: (n) => `${n} has announced its next dates`,
  SPEAK_30: (n) => `${n}: speaker proposals close in about a month`,
  SPEAK_7: (n) => `${n}: speaker proposals close this week`,
  DECIDE: (n) => `Are you going to ${n}? Decide while early pricing lasts`,
  BOOK: (n) => `${n}: book your ticket, flights and hotel`,
  NETWORK_PREP: (n) => `${n} is a month away: write the people you want to meet`,
  FINAL: (n) => `${n} is next week: plan your days`,
}

const DEFAULT_SEND_CAP = 25
/** 0 means paused. Only a missing or unreadable value falls back to the default (a plain `|| default` would turn 0 into 25). */
export function sendCap(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_SEND_CAP
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : DEFAULT_SEND_CAP
}

