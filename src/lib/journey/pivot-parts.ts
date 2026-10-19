// The redesigned pivot page is three parts (docs/open-decisions.md, item 11), one at a time:
//   now  - where you are now: what transfers
//   go   - where you could go: other roles you could do
//   plan - the plan to get there
// Pure and client-safe. This file also holds the positive wording for the feelings, stances and feasibility
// tiers; the stored keys never change, only what the redesigned page says.

import type { PivotTier } from './feasibility'
import type { PivotFeeling, PivotStance } from './pivot'

export const PIVOT_PARTS = [
  { key: 'now', label: 'Where you are now', intro: 'What you already have that carries over, and the facts it rests on.' },
  { key: 'go', label: 'Where you could go', intro: 'Other roles you could do, each with the reason it fits.' },
  { key: 'plan', label: 'Your plan', intro: 'The steps to get there, at the pace you choose.' },
] as const
export type PivotPart = (typeof PIVOT_PARTS)[number]['key']

export function parsePivotPart(v: string | string[] | undefined): PivotPart {
  const one = Array.isArray(v) ? v[0] : v
  return PIVOT_PARTS.find((p) => p.key === one)?.key ?? 'now'
}

export const pivotPartHref = (part: PivotPart, extra: Record<string, string> = {}): string => {
  const q = new URLSearchParams({ part, ...extra })
  return `/dashboard/pivot-paths?${q.toString()}`
}

/** How each feeling reads on the redesigned page. */
export const POSITIVE_FEELING_LABEL: Record<PivotFeeling, string> = {
  EXCITED: 'Excited',
  CURIOUS: 'Curious',
  UNSURE: 'Still deciding',
  NERVOUS: 'Building confidence',
  SCARED: 'Taking it slowly',
}

export const POSITIVE_STANCE_LABEL: Record<PivotStance, string> = {
  WONDERING: 'On my radar',
  TRYING: 'Trying it out',
  PREPARING: 'Getting ready',
  GOING_FOR_IT: 'Going for it',
  SET_ASIDE: 'Saved for later',
}

export const POSITIVE_TIER_LABEL: Record<PivotTier, string> = {
  SAME: 'Your current field',
  ADJACENT: 'A natural move',
  BRIDGE: 'Within reach with some learning',
  REBUILD: 'A longer road, with a plan',
  LICENSED: 'Open to you with a license',
  LEVEL_GATED: 'A step up in level',
}

export interface TransferInput {
  /** Their current function or role, as they would say it. */
  from: string | null
  level: string | null
  yearsExperience: number | null
  skills: string[]
  ownedFunctions: string[]
  industries: string[]
}

export interface TransferRow {
  label: string
  value: string
  /** The fact it rests on. */
  why: string
}

export interface TransferFacts {
  headline: string
  rows: TransferRow[]
}

/** Trimmed, blanks dropped, repeats (any case) dropped, first spelling kept. */
function unique(xs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of xs) {
    const t = x.trim()
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }
  return out
}

/** What carries over from where they are now. Only what is on file, each with where it came from. */
export function transferFacts(i: TransferInput): TransferFacts {
  const rows: TransferRow[] = []
  const skills = unique(i.skills).slice(0, 8)
  if (skills.length > 0) rows.push({ label: 'Skills you already use', value: skills.join(', '), why: 'From your resume and the skills you confirmed.' })
  const owned = unique(i.ownedFunctions).filter((f) => f.toLowerCase() !== (i.from ?? '').toLowerCase())
  if (owned.length > 0) rows.push({ label: 'Other functions you have run', value: owned.join(', '), why: 'You told us on Track record.' })
  const industries = unique(i.industries).slice(0, 5)
  if (industries.length > 0) rows.push({ label: 'Industries you know', value: industries.join(', '), why: 'From your work history.' })
  if (i.level) {
    const years = i.yearsExperience && i.yearsExperience > 0 ? `, ${i.yearsExperience} years of experience` : ''
    rows.push({ label: 'The level you bring', value: `${i.level}${years}`, why: 'From your resume. Most moves keep your level when the skills carry over.' })
  }
  return {
    headline: i.from ? `What you can take with you from ${i.from}` : 'What you can take with you',
    rows,
  }
}
