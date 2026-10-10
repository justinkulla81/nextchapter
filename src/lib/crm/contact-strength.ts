/**
 * How warm our relationship with a CRM person is, from facts only: nothing
 * here writes warmth, and it never guesses. "A warm contact helps a lot, any
 * contact helps a little."
 *
 * - hot: a first-degree connection (marked HOT, a LinkedIn connection, or seen
 *   as 1st), or they replied and we have been in touch in the last 90 days
 * - warm: a second-degree connection (marked WARM, or seen as 2nd), they have
 *   ever replied, or we have been in touch in the last year
 * - any: a person in the CRM who is more than a directory entry
 * - null: a directory entry we added ourselves (a board director or college
 *   office head from a public page) that nobody has touched. That is contact
 *   *information*, already scored on its own, not a relationship.
 */
export type ContactStrength = 'hot' | 'warm' | 'any'

export interface ContactPerson {
  warmth: string
  connectedAt: Date | null
  /** "1st" / "2nd" / "3rd" as last read off their LinkedIn profile. */
  linkedinDegree?: string | null
  firstRepliedAt: Date | null
  lastTouchedAt: Date | null
  touchCount: number
  notes: string | null
}

const DAY = 86_400_000
/** Notes written by the pipelines that add public directory contacts (board-crm.ts, college-crm.ts). */
const AUTO_ADDED = /From the (CareerOneStop directory|college's own website)/i

export function isAutoAdded(p: Pick<ContactPerson, 'notes'>): boolean {
  return !!p.notes && AUTO_ADDED.test(p.notes)
}

export function contactStrength(p: ContactPerson, now: Date = new Date()): ContactStrength | null {
  const since = p.lastTouchedAt ? (now.getTime() - p.lastTouchedAt.getTime()) / DAY : Infinity
  const touched = p.touchCount > 0 && since <= 365
  const degree = (p.linkedinDegree ?? '').toLowerCase()
  if (p.warmth === 'HOT' || p.connectedAt || degree.includes('1st') || (p.firstRepliedAt && since <= 90)) return 'hot'
  if (p.warmth === 'WARM' || degree.includes('2nd') || p.firstRepliedAt || touched) return 'warm'
  if (isAutoAdded(p)) return null
  return 'any'
}

const ORDER: ContactStrength[] = ['hot', 'warm', 'any']
export function strongerContact(a: ContactStrength | null | undefined, b: ContactStrength | null | undefined): ContactStrength | null {
  return !a ? b ?? null : !b ? a : ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b
}
