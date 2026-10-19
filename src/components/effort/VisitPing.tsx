'use client'

import { useEffect } from 'react'
import { recordVisit } from '@/app/dashboard/record-visit'

/**
 * Tells the server the member opened NextChapter today, once per browser per UTC day, so a visit
 * counts toward unlock points without a database write on every page. Renders nothing.
 */
export function VisitPing() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (window.localStorage.getItem('nc-visit-day') === today) return
      window.localStorage.setItem('nc-visit-day', today)
    } catch {
      // Storage blocked: still record, the server counts a day once.
    }
    void recordVisit().catch(() => {})
  }, [])
  return null
}
