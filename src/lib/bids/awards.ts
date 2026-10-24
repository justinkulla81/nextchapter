import { normalizeOrgName } from '@/lib/text/org-name-match'

// Federal awards won by organisations that sell outplacement, reemployment, career services or
// workforce technology, from USAspending.gov (public, free, no key). Pure rules here, network and
// storage in awards-sync.ts. Tested in src/test/competitor-awards.test.ts.
//
// Matching is by recipient NAME, which is how USAspending is searchable, so it can be wrong. EXACT means
// the recipient's name equals the competitor's (after dropping Inc/LLC and punctuation) and the name is
// distinctive. REVIEW means it only looks the same — a common one-word name like "Pivot" —
// and the CRM lists those apart for a person to confirm instead of guessing.

const key = (n: string) => normalizeOrgName(n).replace(/ (llp|lp|pllc|pc)$/, '')

/** Not in the competitor table yet, but named in the Workforce Competitor Landscape or known WIOA operators. */
export const EXTRA_COMPETITORS = [
  'Maximus', 'Equus Workforce Solutions', 'Fedcap', 'Conduent', 'Ross Innovative Employment Solutions', 'Educational Data Systems',
  'Empyra', 'WIN Learning', 'Xello', 'YouScience', 'Hidden Talent', 'Workbay', 'Launchpad Technologies', 'Opportunity@Work',
]

/** USAspending files some of these under their legal or parent name. */
const ALIASES: Record<string, string[]> = {
  lhh: ['Lee Hecht Harrison'],
  'right management': ['Right Management'],
  'randstad risesmart': ['RiseSmart', 'Randstad Enterprise'],
  'intoo usa': ['Intoo', 'CareerArc'],
  'jobs for the future jff': ['Jobs for the Future'],
  'win learning': ['WIN Learning'],
  'bonterra formerly social solutions': ['Bonterra Tech', 'Social Solutions'],
  'monsterworks monster government solutions': ['Monster Government Solutions', 'Apply Government Solutions'],
}

/** One-word names distinctive enough that an exact match is trusted. */
const DISTINCTIVE = new Set(['maximus', 'conduent', 'fedcap', 'lightcast', 'eightfold', 'bonterra', 'careerminds', 'kuder', 'skillsoft', 'pluralsight', 'coursera', 'handshake', 'empyra', 'xello', 'youscience', 'schoolinks', 'degreed', 'docebo', 'workday', 'goodwill', 'easterseals', 'futurefit', 'monsterworks', 'workbay', 'careeronestop', 'jobscan', 'upwork', 'toptal'])

// Words USAspending adds to a parent name ("MAXIMUS US SERVICES INC", "FEDCAP REHABILITATION SERVICES").
const GENERIC_TAIL = new Set(['us', 'usa', 'america', 'american', 'federal', 'services', 'service', 'holdings', 'group', 'international', 'solutions', 'workforce', 'rehabilitation', 'industries', 'government', 'public', 'sector', 'technologies', 'technology', 'education', 'learning', 'systems'])

/** Names to search USAspending for, from one competitor entry like "Drake Beam Morin (now Lee Hecht Harrison)" or "A / B". */
export function searchNames(name: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => { const t = s.replace(/\s+/g, ' ').trim(); if (t.length >= 3 && !/\.(com|ai|io|co|app)\b/i.test(t) && !/^(formerly|now|a |an |the )/i.test(t)) out.add(t) }
  const noParen = name.replace(/\([^)]*\)/g, ' ')
  add(noParen)
  for (const part of noParen.split(/\s+\/\s+/)) add(part)
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    const inner = m[1].replace(/^(formerly|now|parent of|operated by|a)\s+/i, '').replace(/^merged into\s+/i, '')
    if (/\b(formerly|now)\b/i.test(m[1]) || /^operated by/i.test(m[1])) add(inner)
  }
  for (const a of ALIASES[key(noParen)] ?? []) add(a)
  return [...out]
}

export type Confidence = 'EXACT' | 'REVIEW'

/** How well a USAspending recipient name fits a search name, or null if it does not. */
export function matchRecipient(searchName: string, recipient: string): Confidence | null {
  const want = key(searchName)
  const got = key(recipient)
  if (!want || !got) return null
  const words = want.split(' ')
  const trusted = words.length >= 2 || DISTINCTIVE.has(want.replace(/ /g, ''))
  if (got === want) return trusted ? 'EXACT' : 'REVIEW'
  if (got.startsWith(`${want} `)) {
    const tail = got.slice(want.length + 1).split(' ')
    if (tail.every((w) => GENERIC_TAIL.has(w) || /^\d+$/.test(w))) return trusted ? 'EXACT' : 'REVIEW'
  }
  return null
}

export interface RawAward {
  generatedId: string | null
  awardId: string | null
  recipient: string
  amount: number
  agency: string | null
  subAgency: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
}

export interface MatchedAward extends RawAward {
  competitorName: string
  confidence: Confidence
  kind: 'CONTRACT' | 'GRANT'
}

/** Keeps awards whose recipient fits any of the competitor's names, once each, best confidence first. */
export function matchAwards(competitorName: string, kind: 'CONTRACT' | 'GRANT', awards: RawAward[]): MatchedAward[] {
  const names = searchNames(competitorName)
  const out: MatchedAward[] = []
  for (const a of awards) {
    if (!a.generatedId || !(a.amount > 0)) continue
    let best: Confidence | null = null
    for (const n of names) {
      const c = matchRecipient(n, a.recipient)
      if (c === 'EXACT') { best = 'EXACT'; break }
      if (c) best = 'REVIEW'
    }
    if (best) out.push({ ...a, competitorName, confidence: best, kind })
  }
  return out
}

export const awardUrl = (generatedId: string) => `https://www.usaspending.gov/award/${encodeURIComponent(generatedId)}`
