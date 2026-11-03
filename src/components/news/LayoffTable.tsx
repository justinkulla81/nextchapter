'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { TrackerRow } from '@/lib/warn/public-tracker'
import { countryName } from '@/lib/warn/layoff-country-rules'
import { posthog } from '@/lib/posthog/client'
import { stateName } from '@/lib/seo/states'
import { cn } from '@/lib/utils'

// The tracker's table with filters: country, state, industry (dropdowns: many options) and layoff size (buttons: four).
// Filtering is in the browser over the rows the page already loaded, so it is instant and the page stays cacheable.

const PAGE = 50
const NONE = 'none'
type Size = 'all' | 'small' | 'mid' | 'large'
const SIZES: { key: Size; label: string }[] = [
  { key: 'all', label: 'All sizes' },
  { key: 'small', label: 'Under 100' },
  { key: 'mid', label: '100 to 999' },
  { key: 'large', label: '1,000 or more' },
]

function inSize(workers: number | null, size: Size): boolean {
  if (size === 'all') return true
  if (workers == null) return false
  return size === 'small' ? workers < 100 : size === 'mid' ? workers < 1000 : workers >= 1000
}

const SELECT = 'rounded-md border border-border bg-white px-3 py-2 text-sm text-navy'
const LABEL = 'text-xs font-medium text-muted-foreground'

function counted<T extends string>(values: (T | null)[]): { value: T; n: number }[] {
  const m = new Map<T, number>()
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].map(([value, n]) => ({ value, n }))
}

export function LayoffTable({ rows }: { rows: TrackerRow[] }) {
  const [country, setCountry] = useState('all')
  const [usState, setUsState] = useState('all')
  const [industry, setIndustry] = useState('all')
  const [size, setSize] = useState<Size>('all')
  const [shown, setShown] = useState(PAGE)

  const countries = useMemo(
    () => counted(rows.map((r) => r.country)).map((c) => ({ ...c, label: countryName(c.value) })).sort((a, b) => a.label.localeCompare(b.label)),
    [rows],
  )
  const noCountry = rows.filter((r) => !r.country).length
  const states = useMemo(
    () => counted(rows.map((r) => r.state || null)).map((s) => ({ ...s, label: stateName(s.value) || s.value })).sort((a, b) => a.label.localeCompare(b.label)),
    [rows],
  )
  const industries = useMemo(() => counted(rows.map((r) => r.industry)).sort((a, b) => a.value.localeCompare(b.value)), [rows])
  const noIndustry = rows.filter((r) => !r.industry).length

  // A state belongs to the United States; with another country chosen there is nothing to pick.
  const showState = country === 'all' || country === 'US'

  const filtered = useMemo(
    () => rows.filter((r) =>
      (country === 'all' || (country === NONE ? !r.country : r.country === country))
      && (!showState || usState === 'all' || r.state === usState)
      && (industry === 'all' || (industry === NONE ? !r.industry : r.industry === industry))
      && inSize(r.workers, size)),
    [rows, country, usState, industry, size, showState],
  )
  const active = country !== 'all' || usState !== 'all' || industry !== 'all' || size !== 'all'

  function track(next: { country: string; usState: string; industry: string; size: Size }) {
    const count = rows.filter((r) =>
      (next.country === 'all' || (next.country === NONE ? !r.country : r.country === next.country))
      && (next.usState === 'all' || r.state === next.usState)
      && (next.industry === 'all' || (next.industry === NONE ? !r.industry : r.industry === next.industry))
      && inSize(r.workers, next.size)).length
    posthog.capture('layoff_tracker_filtered', { ...next, results: count })
  }
  function change(patch: Partial<{ country: string; usState: string; industry: string; size: Size }>) {
    const next = { country, usState, industry, size, ...patch }
    if (patch.country && patch.country !== 'all' && patch.country !== 'US') next.usState = 'all'
    setCountry(next.country); setUsState(next.usState); setIndustry(next.industry); setSize(next.size); setShown(PAGE)
    track(next)
  }
  function clear() { change({ country: 'all', usState: 'all', industry: 'all', size: 'all' }) }

  const visible = filtered.slice(0, shown)

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-4 rounded-xl border border-border bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Country</span>
          <select className={SELECT} value={country} onChange={(e) => change({ country: e.target.value })}>
            <option value="all">All countries</option>
            {countries.map((c) => <option key={c.value} value={c.value}>{c.label} ({c.n})</option>)}
            {noCountry > 0 && <option value={NONE}>Not stated ({noCountry})</option>}
          </select>
        </label>
        {showState && (
          <label className="flex flex-col gap-1">
            <span className={LABEL}>State</span>
            <select className={SELECT} value={usState} onChange={(e) => change({ usState: e.target.value })}>
              <option value="all">All states</option>
              {states.map((s) => <option key={s.value} value={s.value}>{s.label} ({s.n})</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Industry</span>
          <select className={SELECT} value={industry} onChange={(e) => change({ industry: e.target.value })}>
            <option value="all">All industries</option>
            {industries.map((i) => <option key={i.value} value={i.value}>{i.value} ({i.n})</option>)}
            {noIndustry > 0 && <option value={NONE}>Not classified ({noIndustry})</option>}
          </select>
        </label>
        <div role="group" aria-label="Layoff size" className="flex flex-col gap-1">
          <span className={LABEL}>Layoff size</span>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={size === s.key}
                onClick={() => change({ size: s.key })}
                className={cn('rounded-md border px-3 py-2 text-sm', size === s.key ? 'border-brand bg-brand text-white' : 'border-border bg-white text-navy hover:border-brand')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {active && (
          <button type="button" onClick={clear} className="py-2 text-sm text-primary underline underline-offset-4">Clear filters</button>
        )}
      </div>

      <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
        Showing {Math.min(shown, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} layoffs
        {size !== 'all' && '. Layoffs that do not state a number of workers are left out when you filter by size.'}
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">The most recent layoff notices, newest first</caption>
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">Date</th>
              <th scope="col" className="px-3 py-3 font-medium">Employer</th>
              <th scope="col" className="px-3 py-3 font-medium">Industry</th>
              <th scope="col" className="px-3 py-3 font-medium">Employees affected</th>
              <th scope="col" className="px-3 py-3 font-medium">Place</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Workers</th>
              <th scope="col" className="px-3 py-3 font-medium">Takes effect</th>
              <th scope="col" className="px-3 py-3 font-medium">Sources</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => (
              <tr key={r.key}>
                <td className="px-3 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{r.noticeDate}</td>
                <th scope="row" className="px-3 py-3 font-medium text-navy">
                  {r.href
                    ? <Link href={r.href} className="text-brand underline-offset-4 hover:underline" title={`Were you affected? ${r.employer} layoff help and details`}>{r.employer}</Link>
                    : r.employer}
                  {r.unconfirmed && (
                    <span className="ml-2 rounded-full bg-off-white px-2 py-0.5 align-middle text-xs font-normal text-muted-foreground">1 source</span>
                  )}
                  {(r.division || r.type || r.sites > 1) && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {[r.division ? `${r.division} division` : null, r.type, r.sites > 1 ? `${r.sites} sites` : null].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </th>
                <td className="px-3 py-3">{r.industry ?? '—'}</td>
                <td className="px-3 py-3">{r.roles.length ? r.roles.join(', ') : '—'}</td>
                <td className="px-3 py-3">
                  {r.state || (r.country ? countryName(r.country) : '—')}
                  {r.county && <span className="block text-xs text-muted-foreground">{r.county}</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{r.workers != null ? r.workers.toLocaleString() : '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{r.effectiveDate ?? '—'}</td>
                <td className="px-3 py-3 break-words">
                  <ul className="space-y-0.5">
                    {r.sources.slice(0, 3).map((x) => (
                      <li key={x.label}>
                        {x.url
                          ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{x.label}</a>
                          : x.label}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No layoffs match these filters.{' '}
                  <button type="button" onClick={clear} className="text-primary underline underline-offset-4">Clear filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:border-brand"
        >
          Show {Math.min(PAGE, filtered.length - shown)} more layoffs
        </button>
      )}
    </div>
  )
}
