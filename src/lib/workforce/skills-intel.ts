// Skills intelligence, pure: demand (from postings), supply (from résumé keywords of consenting people), the gap between them, and
// anonymous candidate profiles. No database here; the screens load the rows. Counts under MIN_GROUP are never shown.

import { SKILLS, type SkillCount } from './skills-dictionary'

export const MIN_GROUP = 5

export type Person = {
  function: string | null
  industry: string | null
  level: string | null // CandidateProfile.highestLevelReached: IC, Manager, Director, VP, C-Suite
  years: number | null
  weeksOut: number | null // weeks since a layoff, for people still searching
  keywords: string[]
  dossier: boolean // chose to share their profile with employers and partners (SHARE_DOSSIER_WITH_EMPLOYERS)
}

export type Band = 'Individual contributor' | 'Manager' | 'Director or above'
export function seniorityBand(level: string | null, years: number | null): Band | null {
  if (level) {
    const l = level.toLowerCase()
    if (l === 'ic' || l.includes('individual')) return 'Individual contributor'
    if (l.includes('manager')) return 'Manager'
    if (l.includes('director') || l === 'vp' || l.includes('vice') || l.includes('c-suite') || l.includes('chief')) return 'Director or above'
  }
  if (years != null) return years >= 15 ? 'Director or above' : years >= 8 ? 'Manager' : 'Individual contributor'
  return null
}

export type WeeksBand = '0 to 12 weeks out' | '13 to 25 weeks out' | '26 weeks or more out'
export function weeksBand(w: number | null): WeeksBand | null {
  if (w == null) return null
  return w >= 26 ? '26 weeks or more out' : w >= 13 ? '13 to 25 weeks out' : '0 to 12 weeks out'
}

/** The vocabulary skills a person's keywords name. */
export function skillsOf(keywords: string[]): string[] {
  const text = keywords.join(' | ')
  return SKILLS.filter((s) => s.test.test(text)).map((s) => s.skill)
}

export type GapRow = { skill: string; demandPostings: number; demandShare: number; supplyPeople: number | null; supplyShare: number | null; gap: number | null }

/** Demand against supply for each skill named in postings. Supply is hidden (null) when fewer than MIN_GROUP people have it. */
export function gapRows(demand: SkillCount[], people: Person[], limit = 14): GapRow[] {
  const n = people.length
  const have = new Map<string, number>()
  for (const p of people) for (const s of new Set(skillsOf(p.keywords))) have.set(s, (have.get(s) ?? 0) + 1)
  return demand.slice(0, limit).map((d) => {
    const c = have.get(d.skill) ?? 0
    const shown = n >= MIN_GROUP && c >= MIN_GROUP
    const share = n ? c / n : 0
    return { skill: d.skill, demandPostings: d.postings, demandShare: d.share, supplyPeople: shown ? c : null, supplyShare: n >= MIN_GROUP ? share : null, gap: n >= MIN_GROUP ? d.share - share : null }
  })
}

export type Counted = { label: string; n: number | null }
/** Counts by a label, each under MIN_GROUP hidden (null). */
export function countBy(people: Person[], pick: (p: Person) => string | null): Counted[] {
  const m = new Map<string, number>()
  for (const p of people) {
    const k = pick(p)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].map(([label, n]) => ({ label, n: n >= MIN_GROUP ? n : null })).sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
}

export type AnonProfile = { label: string; function: string; industry: string | null; band: Band; weeks: WeeksBand | null; skills: string[]; summary: string }

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * "Candidate A, B, C": de-identified profiles of people who chose to share their profile. Only coarse fields. A person is shown
 * only if at least MIN_GROUP people share their function and seniority band (so a rare combination cannot point to one person);
 * the industry is shown only if MIN_GROUP people share function, band and industry. Letters are assigned in a shuffled order
 * that changes with `seed`, so a letter never maps to a record order.
 */
export function anonymizeCandidates(people: Person[], seed: string, max = 12): { profiles: AnonProfile[]; hidden: number } {
  const eligible = people.filter((p) => p.dossier && p.function && seniorityBand(p.level, p.years))
  const key = (p: Person) => `${p.function}|${seniorityBand(p.level, p.years)}`
  const keyI = (p: Person) => `${key(p)}|${p.industry ?? ''}`
  const group = new Map<string, number>()
  const groupI = new Map<string, number>()
  for (const p of eligible) {
    group.set(key(p), (group.get(key(p)) ?? 0) + 1)
    groupI.set(keyI(p), (groupI.get(keyI(p)) ?? 0) + 1)
  }
  const shown = eligible.filter((p) => (group.get(key(p)) ?? 0) >= MIN_GROUP)
  const order = shown.map((p, i) => ({ p, h: hash(`${seed}:${i}:${key(p)}`) })).sort((a, b) => a.h - b.h)
  const profiles = order.slice(0, max).map(({ p }, i) => {
    const band = seniorityBand(p.level, p.years) as Band
    const industry = p.industry && (groupI.get(keyI(p)) ?? 0) >= MIN_GROUP ? p.industry : null
    const skills = skillsOf(p.keywords).slice(0, 5)
    const weeks = weeksBand(p.weeksOut)
    const label = `Candidate ${LETTERS[i % 26]}${i >= 26 ? Math.floor(i / 26) + 1 : ''}`
    const summary = `${band} in ${String(p.function).toLowerCase()}${industry ? `, ${industry}` : ''}${weeks ? `, out of work ${weeks.replace(' out', '')}` : ''}. ${skills.length ? `Skills: ${skills.join(', ')}.` : ''}`.trim()
    return { label, function: String(p.function), industry, band, weeks, skills, summary }
  })
  return { profiles, hidden: eligible.length - shown.length }
}
