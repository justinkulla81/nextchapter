'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ALL_STATE_CODES } from '@/lib/seo/states'

const KEY = 'nc_state'
const EVENT = 'nc-state-change'

const valid = (s: unknown): s is string => typeof s === 'string' && ALL_STATE_CODES.includes(s)

function read(): string | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return valid(v) ? v : null
  } catch {
    return null
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
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
  window.dispatchEvent(new Event(EVENT))
}

/** The visitor's state: the one they chose before, else the detected one (a single cheap request, never blocking the page), else null. */
export function useVisitorState(): { state: string | null; detected: boolean } {
  const saved = useSyncExternalStore(subscribe, read, () => null)
  const [guess, setGuess] = useState<string | null>(null)
  useEffect(() => {
    if (saved) return
    let live = true
    fetch('/api/visitor-state', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { state?: string | null } | null) => {
        if (live && j && valid(j.state)) setGuess(j.state)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [saved])
  return saved ? { state: saved, detected: false } : { state: guess, detected: guess != null }
}
