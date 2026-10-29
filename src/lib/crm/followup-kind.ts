/**
 * Where a person's follow-up came from, read from the note it was written with (no column): the system writes a fixed opening for each
 * kind, and anything else was typed in by hand. Used to mark, filter and group follow-ups on the People follow-ups list and in To-dos.
 */
export type FollowUpType = 'layoffs' | 'claim' | 'reply' | 'yours'

export interface FollowUpKind {
  type: FollowUpType
  /** Put there by the system, not by you. */
  automated: boolean
  label: string
}

export const FOLLOW_UP_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'yours', label: 'Yours' },
  { key: 'automated', label: 'Automated' },
  { key: 'layoffs', label: 'Layoffs' },
] as const
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number]['key']

export function followUpKind(note: string | null | undefined): FollowUpKind {
  const n = (note ?? '').trim()
  if (/^P0 rapid response/i.test(n)) return { type: 'layoffs', automated: true, label: 'Layoffs' }
  if (/^(Asked to activate|Claimed) the /i.test(n)) return { type: 'claim', automated: true, label: 'Page claim' }
  if (/^Replied to cold outreach/i.test(n)) return { type: 'reply', automated: true, label: 'Reply' }
  return { type: 'yours', automated: false, label: 'Yours' }
}

export function parseFollowUpFilter(v: string | undefined): FollowUpFilter {
  return FOLLOW_UP_FILTERS.find((f) => f.key === v)?.key ?? 'all'
}

export function matchesFollowUpFilter(k: FollowUpKind, f: FollowUpFilter): boolean {
  return f === 'all' ? true : f === 'yours' ? !k.automated : f === 'automated' ? k.automated : k.type === 'layoffs'
}
