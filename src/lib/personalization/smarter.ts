// "Your board got smarter": one or two plain lines, each only when something real changed —
// on the board and in Job Search Daily. Pure: src/test/personalization.test.ts.

import type { RetuneTrigger } from '@/lib/personalization/match-verdict'

export const TRIGGER_PHRASE: Record<RetuneTrigger, string> = {
  city: 'added your city',
  tools: 'confirmed your tools',
  clearance: 'updated your clearance and licenses',
  industry: 'confirmed your industries',
  search_strategy: 'updated your search strategy',
  resume: 'uploaded your résumé',
  dismiss: 'changed what you hide',
}

export interface LastRetune {
  trigger: string | null
  at: Date
  before: number | null
  after: number | null
}

const n = (x: number) => x.toLocaleString()
const s = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`

export function smarterLines(input: {
  passedOn: number
  hiddenLikeThem: number
  /** They chose to hide something (a company, a pay floor, "Hide all"). */
  hasHides: boolean
  toolsConfirmed: boolean
  newThisWeekSkills: number
  lastRetune: LastRetune | null
  now?: Date
  max?: number
}): string[] {
  const out: string[] = []
  const now = input.now ?? new Date()
  const r = input.lastRetune
  if (r && r.before !== null && r.after !== null && r.before !== r.after && now.getTime() - r.at.getTime() <= 7 * 86_400_000) {
    const phrase = r.trigger && r.trigger in TRIGGER_PHRASE ? TRIGGER_PHRASE[r.trigger as RetuneTrigger] : 'updated your profile'
    out.push(`Since you ${phrase} on ${r.at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}: ${n(r.before)} → ${s(r.after, 'match', 'matches')}.`)
  }
  if (input.hasHides && input.hiddenLikeThem > 0) {
    out.push(
      input.passedOn > 0
        ? `Because you passed on ${s(input.passedOn, 'job')}, we hid ${n(input.hiddenLikeThem)} like ${input.hiddenLikeThem === 1 ? 'it' : 'them'}.`
        : `Because of what you passed on, we hid ${s(input.hiddenLikeThem, 'job')}.`
    )
  }
  if (input.toolsConfirmed && input.newThisWeekSkills > 0) out.push(`New this week: ${s(input.newThisWeekSkills, 'job')} that match${input.newThisWeekSkills === 1 ? 'es' : ''} your confirmed tools and skills.`)
  return out.slice(0, input.max ?? 2)
}

/** A move this small in the week-on-week match count isn't news. */
export const TREND_MIN_SHARE = 0.1
export const TREND_MIN_JOBS = 3

/**
 * Job Search Daily's "What changed for you": at most three lines — the match count against a
 * week ago, what we learned since the last email, and saved jobs that closed before they
 * applied. Empty when nothing changed (the section is left out).
 */
export function whatChangedLines(input: {
  matchesNow: number | null
  matchesWeekAgo: number | null
  /** Retunes since the last email, newest first. */
  learned: { trigger: string | null; before: number | null; after: number | null }[]
  closedBeforeApplied: number
}): string[] {
  const out: string[] = []
  const { matchesNow: now, matchesWeekAgo: then } = input
  if (now !== null && then !== null && then > 0) {
    const delta = now - then
    if (Math.abs(delta) >= TREND_MIN_JOBS && Math.abs(delta) / then >= TREND_MIN_SHARE) {
      out.push(`Your matches: ${n(now)}, ${delta > 0 ? 'up' : 'down'} from ${n(then)} a week ago (${delta > 0 ? '+' : '−'}${Math.round((Math.abs(delta) / then) * 100)}%).`)
    }
  }
  const l = input.learned.find((r) => r.before !== null && r.after !== null && r.before !== r.after)
  if (l) {
    const phrase = l.trigger && l.trigger in TRIGGER_PHRASE ? TRIGGER_PHRASE[l.trigger as RetuneTrigger] : 'updated your profile'
    out.push(`You ${phrase}: ${n(l.before!)} → ${s(l.after!, 'match', 'matches')}.`)
  }
  if (input.closedBeforeApplied > 0) {
    const c = input.closedBeforeApplied
    out.push(`${s(c, 'job')} you saved closed before you applied. Applying within 72 hours of saving beats the rush.`)
  }
  return out.slice(0, 3)
}
