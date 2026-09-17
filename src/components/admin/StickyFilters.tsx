'use client'

import { useEffect } from 'react'

const YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Remembers the filters this admin last used on a list, across sessions.
 *
 * A working list is worked the same way every day — "contacted at least
 * once, P0 first" is a standing view, not a per-visit decision — and
 * re-picking it from a bare URL every morning is the kind of friction that
 * makes a list stop being opened at all.
 *
 * A cookie rather than a row: this is a per-browser preference, it has to be
 * readable on the server during the very first render (so the page can
 * redirect to the remembered view before painting anything), and it is
 * worth no schema. Writing it here rather than in the filter bar means it
 * records the filters the page ACTUALLY applied, not what a form posted.
 *
 * An empty `value` deletes the cookie, which is what "Clear" relies on —
 * otherwise clearing would bounce straight back to the saved view.
 */
export function StickyFilters({ name, value }: { name: string; value: string }) {
  useEffect(() => {
    document.cookie = value
      ? `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`
      : `${name}=; path=/; max-age=0; samesite=lax`
  }, [name, value])

  return null
}
