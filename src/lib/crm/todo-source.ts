/**
 * Where a CRM to-do came from, so the list can separate what you asked for
 * from what a script or a meeting note dropped in.
 *
 * Derived from fields the task already has (no column), so old rows sort
 * correctly: meeting steps carry a sourceRef, rapid-response lead tasks have
 * a fixed title prefix, and everything else was typed in by hand.
 */
export type TodoSource = 'yours' | 'waiting' | 'automated'

export const AUTOMATED_TITLE_PREFIX = 'Find a contact'

export function todoSource(t: { sourceRef: string | null; title: string }): TodoSource {
  if (t.sourceRef) return t.title.startsWith('Waiting on') ? 'waiting' : 'yours'
  if (t.title.startsWith(AUTOMATED_TITLE_PREFIX)) return 'automated'
  return 'yours'
}
