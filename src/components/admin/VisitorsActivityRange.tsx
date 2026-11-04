'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type TrafficRange = 'day' | '7d' | '30d' | 'all'

export const RANGE_PHRASE: Record<TrafficRange, string> = {
  day: 'in the last 24 hours',
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  all: 'all time',
}

export interface RangeTotals {
  /** Human homepage visit events: page views and link clicks. */
  events: number
  /** Distinct IP addresses among those events. */
  visitors: number
}

const STORAGE_KEY = 'nc_admin_visitor_chart_ranges'
const VALID: TrafficRange[] = ['day', '7d', '30d', 'all']
/** The chart whose range the count under the page title follows. */
export const SUMMARY_CHART = 'traffic'

type Ranges = Record<string, TrafficRange>

const Ctx = createContext<{ rangeFor: (chart: string) => TrafficRange; setRangeFor: (chart: string, r: TrafficRange) => void } | null>(null)

// Holds one time range per chart, so each chart moves on its own. The choices are remembered in this browser
// and restored after a refresh (read after mount, so the server and first client render still match).
export function TrafficRangeProvider({ children }: { children: ReactNode }) {
  const [ranges, setRanges] = useState<Ranges>({})

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>
      const clean: Ranges = {}
      for (const [chart, r] of Object.entries(saved)) if (VALID.includes(r as TrafficRange)) clean[chart] = r as TrafficRange
      setRanges(clean)
    } catch {
      // Storage blocked or unreadable: every chart starts at 30 days.
    }
  }, [])

  const rangeFor = (chart: string): TrafficRange => ranges[chart] ?? '30d'
  const setRangeFor = (chart: string, r: TrafficRange) => {
    setRanges((prev) => {
      const next = { ...prev, [chart]: r }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Not remembered, still changes on screen.
      }
      return next
    })
  }
  return <Ctx.Provider value={{ rangeFor, setRangeFor }}>{children}</Ctx.Provider>
}

/** The shared per-chart ranges when inside a provider, else null (the chart then keeps its own). */
export function useSharedTrafficRange() {
  return useContext(Ctx)
}

const n = (v: number) => v.toLocaleString('en-US')

// The line under the page title. It follows the chart's range buttons.
export function VisitorsRangeSummary({ totals, showBots }: { totals: Record<TrafficRange, RangeTotals>; showBots: boolean }) {
  const ctx = useContext(Ctx)
  const range = ctx?.rangeFor(SUMMARY_CHART) ?? '30d'
  const t = totals[range]
  return (
    <>
      <span className="tabular-nums">{n(t.events)}</span> {showBots ? '' : 'human '}homepage visit events from{' '}
      <span className="tabular-nums">{n(t.visitors)}</span> unique visitors {RANGE_PHRASE[range]}.
    </>
  )
}
