// How well a member fits a search firm, from what the firm's live searches say it recruits for. Pure: fit.test.ts.
// Used to pick the "other firms that fit you" list. It never produces a "not a fit" message for a member: a firm that
// scores low is simply not recommended, and an interest the member chose still goes through.

import { seniorityBandOfMember } from '@/lib/seo/search-firm-bar'

export interface MemberSignals {
  highestLevel: string | null
  functions: (string | null | undefined)[]
  industries: string[]
  state: string | null
}

export interface FirmSignals {
  industries: string[]
  functions: string[]
  seniorities: string[]
  states: string[]
}

export interface FirmFit {
  score: number
  /** Plain reasons, strongest first: "Recruits C-suite finance leaders" style pieces the page can show. */
  reasons: string[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const overlaps = (a: string[], b: string[]) => a.some((x) => b.some((y) => norm(x) === norm(y) || norm(x).includes(norm(y)) || norm(y).includes(norm(x))))

/** A firm with no industry and no function is General: it never gets a fit, so it is never recommended. */
export function fitOf(member: MemberSignals, firm: FirmSignals): FirmFit {
  if (firm.industries.length === 0 && firm.functions.length === 0) return { score: 0, reasons: [] }
  let score = 0
  const reasons: string[] = []
  const band = seniorityBandOfMember(member.highestLevel)
  const fns = member.functions.filter((f): f is string => !!f)
  if (fns.length && overlaps(fns, firm.functions)) { score += 3; reasons.push(`recruits ${firm.functions.filter((f) => overlaps(fns, [f]))[0].toLowerCase()} roles`) }
  if (band && firm.seniorities.includes(band)) { score += 3; reasons.push(`recruits at ${band === 'C-suite' ? 'the C-suite' : band.toLowerCase()} level`) }
  if (member.industries.length && overlaps(member.industries, firm.industries)) { score += 2; reasons.push(`works in ${firm.industries.filter((i) => overlaps(member.industries, [i]))[0].toLowerCase()}`) }
  if (member.state && firm.states.includes(member.state)) score += 1
  return { score, reasons }
}

export const RECOMMEND_MIN_SCORE = 5

export function recommend<T extends FirmSignals & { orgId: string }>(member: MemberSignals, firms: T[], exclude: Set<string>, take = 6): (T & FirmFit)[] {
  return firms
    .filter((f) => !exclude.has(f.orgId))
    .map((f) => ({ ...f, ...fitOf(member, f) }))
    .filter((f) => f.score >= RECOMMEND_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
}
