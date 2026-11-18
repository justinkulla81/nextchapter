// Talent Hub cohorts, pure parts: a cohort is a rule (industry, experience band, function, weeks out of work), not a list of names, so it
// stays current as people join. Who it matches, how big it is without pointing at a person, and what an update says. No database here.

import { MIN_GROUP, countBy, seniorityBand, type Person } from './skills-intel'

export type CohortRule = { industries: string[]; functions: string[]; levels: string[]; minWeeksOut: number | null }

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Does this person fit the cohort? Every dimension the rule names must include the person; an empty dimension matches anyone, and a
 * person with no value on a named dimension is not matched (we never guess someone into a cohort). `minWeeksOut` needs a known time out.
 */
export function cohortMatches(rule: CohortRule, p: Pick<Person, 'industry' | 'function' | 'level' | 'years' | 'weeksOut'>): boolean {
  const band = seniorityBand(p.level, p.years)
  const ok = (wanted: string[], value: string | null) => wanted.length === 0 || (value !== null && wanted.some((w) => norm(w) === norm(value)))
  if (!ok(rule.industries, p.industry) || !ok(rule.functions, p.function) || !ok(rule.levels, band)) return false
  return rule.minWeeksOut === null || (p.weeksOut !== null && p.weeksOut >= rule.minWeeksOut)
}

export type CohortStats = { size: number | null; byFunction: { label: string; n: number | null }[]; byBand: { label: string; n: number | null }[] }

/** The cohort's size and mix, hidden under MIN_GROUP: a staff member never learns that one person is in it. */
export function cohortStats(people: Person[], rule: CohortRule): CohortStats {
  const inside = people.filter((p) => cohortMatches(rule, p))
  const n = inside.length
  const hidden = n < MIN_GROUP
  return {
    size: n === 0 ? 0 : hidden ? null : n,
    byFunction: hidden ? [] : countBy(inside, (p) => p.function).slice(0, 5),
    byBand: hidden ? [] : countBy(inside, (p) => seniorityBand(p.level, p.years)),
  }
}

/** The rule in words, for the list and for the member who sees an update. */
export function ruleLine(rule: CohortRule): string {
  const parts = [
    rule.functions.length ? rule.functions.join(', ') : null,
    rule.industries.length ? rule.industries.join(', ') : null,
    rule.levels.length ? rule.levels.join(', ') : null,
    rule.minWeeksOut !== null ? `out of work ${rule.minWeeksOut} weeks or more` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Everyone in the group'
}

export const WEEKS_OPTIONS = [13, 26, 52] as const

export function canStartCohort(limit: number | null, existing: number): { allowed: boolean; message: string | null } {
  if (limit === null || existing < limit) return { allowed: true, message: null }
  return { allowed: false, message: `The free plan runs ${limit === 1 ? 'one cohort' : `${limit} cohorts`}. Start your free trial, or ask us to switch on the paid plan, to run more.` }
}

export function pickFrom(values: string[], allowed: readonly string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const hit = allowed.find((a) => norm(a) === norm(v))
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out
}

export function validateCohort(
  f: { get: (k: string) => string | null; getAll: (k: string) => string[] },
  allowed: { industries: readonly string[]; functions: readonly string[]; levels: readonly string[] },
): { error: string } | { value: { name: string; purpose: string | null } & CohortRule } {
  const name = (f.get('name') ?? '').trim().slice(0, 80)
  if (!name) return { error: 'Give the cohort a name, such as “Operations managers”.' }
  const purpose = (f.get('purpose') ?? '').trim().slice(0, 300)
  const weeksRaw = (f.get('minWeeksOut') ?? '').trim()
  const minWeeksOut = weeksRaw ? Number(weeksRaw) : null
  if (minWeeksOut !== null && (!Number.isInteger(minWeeksOut) || minWeeksOut < 1 || minWeeksOut > 260)) return { error: 'Weeks out of work must be a whole number, such as 26.' }
  return {
    value: {
      name, purpose: purpose || null, minWeeksOut,
      industries: pickFrom(f.getAll('industries'), allowed.industries), functions: pickFrom(f.getAll('functions'), allowed.functions), levels: pickFrom(f.getAll('levels'), allowed.levels),
    },
  }
}

export function validateCohortPost(f: { get: (k: string) => string | null }): { error: string } | { value: { body: string } } {
  const body = (f.get('body') ?? '').trim().slice(0, 1500)
  return body ? { value: { body } } : { error: 'Write the update before posting it.' }
}
