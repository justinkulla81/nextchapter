// The board's two entry-level filters (2026-10-23), read from postingSignals (posting-signals.ts), which the
// crawler sets from the FULL posting text (nextchapter-jobs ncrawl/entry_signals.py). Pure and client-safe.
//
//   No experience needed  no_experience_ok: an entry / early-career job (crawler level ENTRY_IC or EARLY_IC)
//                         whose posting says, in an allowlisted phrase, that people without experience are
//                         welcome ("no experience required", "0-1 years", "recent graduates", "we will train
//                         you", an apprenticeship, "no degree required" …), and that asks for no 2+ years and no
//                         required years anywhere. The phrase is stored in noExperiencePhrase.
//   Entry-level + AI      entry_ai: an entry / early-career job that asks for AI skills, by the same AI tagger as
//                         "Asks for AI skills" (aiSkillGroups non-empty). entry_ai_preferred: every AI ask in it
//                         says preferred / a plus / nice to have, or sits under a preferred heading.
//
// One URL parameter, `entry`, a comma list of 'noexp' and 'ai'; both on means both must hold.

export const ENTRY_LEVELS = ['ENTRY_IC', 'EARLY_IC'] as const

export const ENTRY_FILTERS = [
  {
    key: 'noexp',
    signal: 'no_experience_ok',
    label: 'No experience needed',
    hint: 'Entry-level jobs whose posting says people without experience are welcome, and that ask for no years of experience.',
  },
  {
    key: 'ai',
    signal: 'entry_ai',
    label: 'Entry-level + AI',
    hint: 'Entry-level and early-career jobs whose posting asks for AI skills.',
  },
] as const
export type EntryFilterKey = (typeof ENTRY_FILTERS)[number]['key']

const KEYS = new Set<string>(ENTRY_FILTERS.map((f) => f.key))

/** The `entry` URL parameter: the filters that are on, in canonical order. */
export function parseEntryParam(v: string | string[] | null | undefined): EntryFilterKey[] {
  const s = Array.isArray(v) ? v.join(',') : (v ?? '')
  const on = new Set(s.split(',').map((x) => x.trim()).filter((x) => KEYS.has(x)))
  return ENTRY_FILTERS.filter((f) => on.has(f.key)).map((f) => f.key)
}

/** The `entry` value with `key` turned on or off; null when none is left. */
export function toggleEntryParam(current: readonly EntryFilterKey[], key: EntryFilterKey): string | null {
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
  const ordered = ENTRY_FILTERS.filter((f) => next.includes(f.key)).map((f) => f.key)
  return ordered.length > 0 ? ordered.join(',') : null
}

/** Does a job with these signals pass every entry filter that is on? */
export function passesEntryFilters(signals: readonly string[] | null | undefined, on: readonly EntryFilterKey[]): boolean {
  const have = new Set(signals ?? [])
  return on.every((k) => have.has(ENTRY_FILTERS.find((f) => f.key === k)!.signal))
}

/** The drawer and public page line: the posting's own words, quoted briefly. Null without a phrase. */
export function noExperienceQuote(phrase: string | null | undefined, max = 140): string | null {
  const p = (phrase ?? '').replace(/\s+/g, ' ').trim()
  if (!p) return null
  if (p.length <= max) return p
  const cut = p.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.…-]+$/, '')}…`
}
