'use client'

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'

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

const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}
function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}
// Used when storage is blocked, so a choice still changes on screen for this visit.
let memoryRaw = ''

function parseRanges(raw: string): Ranges {
  const clean: Ranges = {}
  try {
    for (const [chart, r] of Object.entries(JSON.parse(raw || '{}') as Record<string, string>)) {
      if (VALID.includes(r as TrafficRange)) clean[chart] = r as TrafficRange
    }
  } catch {
    // Unreadable: every chart starts at 30 days.
  }
  return clean
}

// Holds one time range per chart, so each chart moves on its own. The choices are remembered in this browser
// and restored after a refresh. The server render and first client render use 30 days, then the saved choice applies.
export function TrafficRangeProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, () => readRaw() || memoryRaw, () => '')
  const ranges = useMemo(() => parseRanges(raw), [raw])

  const rangeFor = (chart: string): TrafficRange => ranges[chart] ?? '30d'
  const setRangeFor = (chart: string, r: TrafficRange) => {
    memoryRaw = JSON.stringify({ ...parseRanges(readRaw() || memoryRaw), [chart]: r })
    try {
      window.localStorage.setItem(STORAGE_KEY, memoryRaw)
    } catch {
      // Not remembered across refresh, still changes on screen.
    }
    listeners.forEach((l) => l())
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
