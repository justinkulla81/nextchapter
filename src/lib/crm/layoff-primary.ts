import { contactStrength, type ContactPerson, type ContactStrength } from './contact-strength'
import { isHrLeaderTitle } from './org-domains'

/**
 * Who we reach first at a company that is cutting jobs.
 *
 * A warm relationship beats everything: a person we already know at the
 * company is worth more than a stranger with a better title, so they are the
 * primary contact even when a CHRO is on file. Below that: someone named in
 * the coverage of the layoff (a spokesperson's boss, the executive who
 * announced it), then the CHRO, then anyone else we have a real relationship
 * with. A directory entry nobody has touched is information, not a
 * relationship, and is never primary.
 */
export type PrimaryReason = 'warm' | 'coverage' | 'chro' | 'other'

export interface OrgPerson extends ContactPerson {
  id: string
  fullName: string
  /** Their title at this organization. */
  title: string | null
}

/** Notes written by the layoff contact finder (layoff-contacts-run.ts). */
const NAMED_IN_COVERAGE = /named in coverage of the .+ layoff/i

export function isNamedInCoverage(p: Pick<ContactPerson, 'notes'>): boolean {
  return !!p.notes && NAMED_IN_COVERAGE.test(p.notes)
}

export function hasChro(people: Pick<OrgPerson, 'title'>[]): boolean {
  return people.some((p) => isHrLeaderTitle(p.title))
}

const STRENGTH_RANK: Record<ContactStrength, number> = { hot: 0, warm: 1, any: 2 }

export interface PrimaryChoice { person: OrgPerson; reason: PrimaryReason; strength: ContactStrength | null }

export function choosePrimary(people: OrgPerson[], now: Date = new Date()): PrimaryChoice | null {
  const scored = people.map((person) => ({
    person,
    strength: contactStrength(person, now),
    coverage: isNamedInCoverage(person),
    chro: isHrLeaderTitle(person.title),
  }))
  const touched = (p: OrgPerson) => p.lastTouchedAt?.getTime() ?? 0

  const relationship = scored
    .filter((s) => s.strength === 'hot' || s.strength === 'warm')
    .sort((a, b) => STRENGTH_RANK[a.strength!] - STRENGTH_RANK[b.strength!] || touched(b.person) - touched(a.person))
  if (relationship[0]) return { person: relationship[0].person, reason: 'warm', strength: relationship[0].strength }

  const tiers: [(s: (typeof scored)[number]) => boolean, PrimaryReason][] = [
    [(s) => s.coverage, 'coverage'],
    [(s) => s.chro, 'chro'],
    [(s) => s.strength === 'any', 'other'],
  ]
  for (const [test, reason] of tiers) {
    const hit = scored.find(test)
    if (hit) return { person: hit.person, reason, strength: hit.strength }
  }
  return null
}

const day = (d: Date) => d.toISOString().slice(0, 10)

/** What makes a person warm, in words, from the same facts contactStrength reads. */
export function warmthReason(p: ContactPerson): string {
  const bits: string[] = []
  if (p.connectedAt || (p.linkedinDegree ?? '').toLowerCase().includes('1st')) bits.push('1st-degree LinkedIn connection')
  else if ((p.linkedinDegree ?? '').toLowerCase().includes('2nd')) bits.push('2nd-degree LinkedIn connection')
  if (p.firstRepliedAt) bits.push(`has replied to us (first ${day(p.firstRepliedAt)})`)
  if (p.touchCount > 0 && p.lastTouchedAt) bits.push(`${p.touchCount} touch${p.touchCount === 1 ? '' : 'es'}, last ${day(p.lastTouchedAt)}`)
  if (!bits.length && p.warmth !== 'UNKNOWN' && p.warmth !== 'COLD') bits.push(`marked ${p.warmth.toLowerCase()}`)
  return bits.join('; ') || 'existing relationship'
}

export function primaryWhy(employer: string, c: PrimaryChoice): string {
  const who = c.person.fullName
  if (c.reason === 'warm') return `Primary contact for the ${employer} layoff: ${who}, because the relationship is warm (${warmthReason(c.person)}). Start with them, not a cold CHRO email.`
  if (c.reason === 'coverage') return `Primary contact for the ${employer} layoff: ${who}, named in the coverage of it. No warm relationship at the company yet.`
  if (c.reason === 'chro') return `Primary contact for the ${employer} layoff: ${who}, the company's head of HR. No warm relationship or named contact yet.`
  return `Primary contact for the ${employer} layoff: ${who}, the closest relationship we have at the company.`
}
