'use client'

import { createContext, useContext, useState, useCallback } from 'react'

/**
 * Shared hidden-row state for the needs-completion list, so one row's
 * action can hide a DIFFERENT row too — specifically the reciprocal-merge
 * case: two records that each list the other as their suggested duplicate.
 * Merging one into the other resolves both sides of that pair at once, and
 * the survivor shouldn't sit there still flagged as a duplicate until the
 * next full refresh catches up.
 */
const HideContext = createContext<{
  hidden: Set<string>
  hide: (ids: string[]) => void
  unhide: (ids: string[]) => void
} | null>(null)

export function CrmNeedsCompletionList({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const hide = useCallback((ids: string[]) => {
    setHidden((prev) => new Set([...prev, ...ids]))
  }, [])
  const unhide = useCallback((ids: string[]) => {
    setHidden((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [])

  return <HideContext.Provider value={{ hidden, hide, unhide }}>{children}</HideContext.Provider>
}

export function useCrmNeedsCompletionHide() {
  const ctx = useContext(HideContext)
  if (!ctx) throw new Error('useCrmNeedsCompletionHide must be used within CrmNeedsCompletionList')
  return ctx
}
