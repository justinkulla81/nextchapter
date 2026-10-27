'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

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

const Ctx = createContext<{ range: TrafficRange; setRange: (r: TrafficRange) => void } | null>(null)

// Holds the selected time range so the count at the top of the page and the chart below it always agree.
export function TrafficRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<TrafficRange>('30d')
  return <Ctx.Provider value={{ range, setRange }}>{children}</Ctx.Provider>
}

/** The shared range when inside a provider, else null (the chart then keeps its own). */
export function useSharedTrafficRange() {
  return useContext(Ctx)
}

const n = (v: number) => v.toLocaleString('en-US')

// The line under the page title. It follows the chart's range buttons.
export function VisitorsRangeSummary({ totals, showBots }: { totals: Record<TrafficRange, RangeTotals>; showBots: boolean }) {
  const ctx = useContext(Ctx)
  const range = ctx?.range ?? '30d'
  const t = totals[range]
  return (
    <>
      <span className="tabular-nums">{n(t.events)}</span> {showBots ? '' : 'human '}homepage visit events from{' '}
      <span className="tabular-nums">{n(t.visitors)}</span> unique visitors {RANGE_PHRASE[range]}.
    </>
  )
}
