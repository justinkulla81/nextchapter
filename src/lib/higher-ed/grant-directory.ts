// State and foundation funding for colleges, which no free API lists (Candid's
// foundation data is paid; each state runs its own portal). A directory,
// checked by hand on each entry's official page: the `checked` date says when.
// A college sees the entries for its states (profile and region, plus any it
// adds, e.g. a second campus) and every national foundation.
//
// To add an entry: confirm it on the funder's own site, set `checked`, keep
// `note` to what the page says. Never guess a deadline or an amount.

import type { Grant, GrantPurpose } from './grants'
import { DIRECTORY_ENTRIES } from './grant-directory-entries'

export type DirectoryEntry = {
  id: string
  name: string
  funder: string
  kind: 'state' | 'foundation'
  states: string[] // two-letter; [] = national
  purposes: GrantPurpose[]
  how: 'open call' | 'rolling' | 'invitation'
  deadline: string | null // ISO
  amount: string | null
  url: string
  note: string
  checked: string // ISO date the page was confirmed
}

/** Entries for a college's states (national ones always), as grants; a passed deadline drops the entry until it is re-checked. */
export function directoryGrants(states: string[], today: string, entries: DirectoryEntry[] = DIRECTORY_ENTRIES): Grant[] {
  const mine = new Set(states.map((s) => s.toUpperCase()))
  return entries
    .filter((e) => e.states.length === 0 || e.states.some((s) => mine.has(s)))
    .filter((e) => !e.deadline || e.deadline >= today)
    .map((e) => ({
      id: e.id,
      source: e.kind,
      number: '',
      title: e.name,
      agency: e.funder,
      openDate: null,
      closeDate: e.deadline,
      status: 'posted' as const,
      purposes: e.purposes,
      url: e.url,
      how: e.how,
      amount: e.amount,
      note: e.note,
      checked: e.checked,
    }))
}
