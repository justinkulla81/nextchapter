'use server'

import { createClient } from '@/lib/supabase/server'
import { loadSearchIndex, suggestFrom, type SearchSuggestion } from '@/lib/jobs/board-search-index'

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
  const index = await loadSearchIndex().catch(() => null)
  return suggestFrom(index, kind, text)
}
