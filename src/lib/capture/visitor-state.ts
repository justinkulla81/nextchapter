'use client'

import { useEffect, useState } from 'react'
import { ALL_STATE_CODES } from '@/lib/seo/states'

const KEY = 'nc_state'

const valid = (s: unknown): s is string => typeof s === 'string' && ALL_STATE_CODES.includes(s)

function read(): string | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return valid(v) ? v : null
  } catch {
    return null
  }
}

/** Remembers the state a visitor picked (or that was detected) so every page can start from it. Never required: pages render the same without it. */
export function rememberState(code: string) {
  if (!valid(code)) return
  try {
    window.localStorage.setItem(KEY, code)
  } catch {
    /* private window: the page still works without it */
  }
}

/** The visitor's state: the one they chose before, else the detected one (a single cheap request, never blocking the page), else null. */
export function useVisitorState(): { state: string | null; detected: boolean } {
  const [state, setState] = useState<string | null>(null)
  const [detected, setDetected] = useState(false)
  useEffect(() => {
    const saved = read()
    if (saved) {
      setState(saved)
      return
    }
    let live = true
    fetch('/api/visitor-state', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { state?: string | null } | null) => {
        if (live && j && valid(j.state)) {
          setState(j.state)
          setDetected(true)
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return { state, detected }
}
