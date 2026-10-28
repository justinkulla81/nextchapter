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

/**
 * Priority tier, for colour, grouping and the morning brief. Same rule of no
 * column: a system issue is an ADMIN task nobody made from a meeting (the
 * meeting ones that are ADMIN are "waiting on" items and carry a sourceRef).
 *
 *   system    P000  breakage, spam, attacks, performance: drop everything
 *   call      P00   next steps from calls (and what others owe you from them)
 *   todo      P0    what you typed in yourself
 *   automated       lead tasks the system opened; work or clear, not commitments
 */
export type TodoTier = 'system' | 'call' | 'todo' | 'automated'

export const TODO_TIERS: { key: TodoTier; code: string; label: string; hint: string }[] = [
  { key: 'system', code: 'P000', label: 'System issue', hint: 'Breakage, spam, attacks, performance. First.' },
  { key: 'call', code: 'P00', label: 'From calls', hint: 'Next steps from meetings, and what others owe you.' },
  { key: 'todo', code: 'P0', label: 'Your to-dos', hint: 'Things you added yourself.' },
  { key: 'automated', code: 'Auto', label: 'Automated', hint: 'Opened by the system from leads. Work them or clear them.' },
]

export function isTier(v: unknown): v is TodoTier {
  return TODO_TIERS.some((t) => t.key === v)
}

/** A tier set by hand (tierOverride) wins; otherwise it is derived from the task. */
export function todoTier(t: { sourceRef: string | null; title: string; kind: string; tierOverride?: string | null }): TodoTier {
  if (isTier(t.tierOverride)) return t.tierOverride
  if (t.sourceRef) return 'call'
  if (t.title.startsWith(AUTOMATED_TITLE_PREFIX)) return 'automated'
  if (t.kind === 'ADMIN') return 'system'
  return 'todo'
}

/** 9:00 AM ET is the default due time; anything else was set on purpose and is shown. */
const ET = 'America/New_York'

export function dueTimeLabel(d: Date): string | null {
  const t = d.toLocaleTimeString('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' })
  return t === '9:00 AM' ? null : `${t} ET`
}

/** A wall-clock date (YYYY-MM-DD) and time (HH:MM) in New York, as a UTC instant. */
export function etWallToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const want = Date.UTC(y, m - 1, d, hh, mm)
  let utc = want
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ET, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(utc))
    const g = (k: string) => Number(parts.find((p) => p.type === k)!.value)
    utc += want - Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'))
  }
  return new Date(utc)
}

/** A due instant as New York wall-clock date (YYYY-MM-DD) and time (HH:MM), for the edit form. */
export function utcToEtWall(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d)
  const g = (k: string) => parts.find((p) => p.type === k)!.value
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` }
}
