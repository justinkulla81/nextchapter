'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// Filters for the events page. Two long lists (function, industry) are dropdowns; level and "how to get in" have
// four options or fewer, so they are adjacent buttons. State lives in the URL so a filtered view can be shared.
const LEVELS = [
  ['EARLY', 'Early career'],
  ['MID', 'Mid career'],
  ['SENIOR', 'Senior'],
  ['EXECUTIVE', 'Executive'],
] as const
const WAYS = [
  ['cheap', 'Free or cheaper ways in'],
  ['speak', 'You could speak'],
  ['invite', 'Apply or get invited'],
] as const

export function EventFilters({ functions, industries }: { functions: string[]; industries: string[] }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString())
    if (value && next.get(key) !== value) next.set(key, value)
    else next.delete(key)
    posthog.capture('conference_events_filtered', { filter: key, value: next.get(key) })
    router.push(`${path}${next.toString() ? `?${next}` : ''}`, { scroll: false })
  }
  const btn = (active: boolean) =>
    cn('inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium', active ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')
  const sel = 'h-10 rounded-full border border-border bg-background px-4 text-sm text-ink'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="ev-fn">Function</label>
        <select id="ev-fn" className={sel} value={sp.get('function') ?? ''} onChange={(e) => set('function', e.target.value || null)}>
          <option value="">Any function</option>
          {functions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label className="sr-only" htmlFor="ev-ind">Industry</label>
        <select id="ev-ind" className={sel} value={sp.get('industry') ?? ''} onChange={(e) => set('industry', e.target.value || null)}>
          <option value="">Any industry</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Level">
        {LEVELS.map(([v, l]) => <button key={v} type="button" className={btn(sp.get('level') === v)} aria-pressed={sp.get('level') === v} onClick={() => set('level', v)}>{l}</button>)}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="How to get in">
        {WAYS.map(([v, l]) => <button key={v} type="button" className={btn(sp.get('way') === v)} aria-pressed={sp.get('way') === v} onClick={() => set('way', v)}>{l}</button>)}
      </div>
    </div>
  )
}
