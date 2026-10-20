'use server'

import { createClient } from '@/lib/supabase/server'
import { peekSearchIndex, suggestFrom, type SearchSuggestion } from '@/lib/jobs/board-search-index'

/** Typeahead for the board search: locations (remote, metros, states, cities on the board) or companies on the board. */
export async function suggestBoardSearch(kind: 'location' | 'company', typed: string): Promise<SearchSuggestion[]> {
  if ((kind !== 'location' && kind !== 'company') || typeof typed !== 'string') return []
  const text = typed.slice(0, 80)
  if (text.trim().length === 0) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  // Never waits on a cold index: remote, metros and states need none, and the
  // board's cities and companies join in once it is in (the board page warms it).
  return suggestFrom(peekSearchIndex(), kind, text)
}
