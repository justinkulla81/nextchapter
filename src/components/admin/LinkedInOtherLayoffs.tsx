'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { makeDraftFor } from '@/app/support/admin/(portal)/linkedin-drafts/actions'

export interface OtherLayoffRow {
  noticeId: string
  employer: string
  employees: number
  place: string | null
  dateLabel: string | null
  /** Notice date as epoch ms, for sorting. */
  dateMs: number | null
  credibilityLabel: string | null
  warnings: string[]
  sourceUrl: string | null
  state: string | null
  industry: string | null
  publishers: number
  fit: 'target' | 'neutral' | 'elite'
  timeline: string | null
}

const SORTS = [
  { value: 'best', label: 'Most promising' },
  { value: 'size', label: 'Size, largest first' },
  { value: 'date', label: 'Date, newest first' },
  { value: 'state', label: 'State, A to Z' },
  { value: 'industry', label: 'Industry, A to Z' },
] as const
type Sort = (typeof SORTS)[number]['value']

const MIN_SIZES = [100, 250, 500, 1000, 2500]

function Row({ r }: { r: OtherLayoffRow }) {
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3" style={{ cursor: pending ? 'wait' : undefined }}>
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          {r.employer} · {r.employees.toLocaleString('en-US')} jobs{r.place ? ` · ${r.place}` : r.state ? ` · ${r.state}` : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          {r.credibilityLabel ?? 'Not confirmed by the usual rules'}
          {r.industry ? ` · ${r.industry}` : ''}
          {r.publishers > 1 ? ` · ${r.publishers} outlets` : ''}
          {r.fit === 'target' ? ' · broad-audience employer' : r.fit === 'elite' ? ' · elite tech' : ''}
          {r.dateLabel ? ` · ${r.dateLabel}` : ''}
          {r.sourceUrl ? <> · <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a></> : null}
        </p>
        {r.timeline ? <p className="text-sm text-muted-foreground">Timeline: {r.timeline}, so it is ranked lower and not drafted automatically.</p> : null}
        {r.warnings.length ? <p className="text-sm text-destructive">Check: {r.warnings.join('; ')}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {note ? <span role="status" className="text-sm text-muted-foreground">{note}</span> : null}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setNote((await makeDraftFor(r.noticeId)).message))}>
          Make a draft
        </Button>
      </div>
    </li>
  )
}

export function LinkedInOtherLayoffs({ rows }: { rows: OtherLayoffRow[] }) {
  const [sort, setSort] = useState<Sort>('best')
  const [state, setState] = useState('')
  const [industry, setIndustry] = useState('')
  const [minSize, setMinSize] = useState(0)

  const states = useMemo(() => [...new Set(rows.flatMap((r) => (r.state ? [r.state] : [])))].sort(), [rows])
  const industries = useMemo(() => [...new Set(rows.flatMap((r) => (r.industry ? [r.industry] : [])))].sort(), [rows])

  const shown = useMemo(() => {
    const kept = rows.filter((r) =>
      (!state || (state === '__none' ? !r.state : r.state === state)) &&
      (!industry || (industry === '__none' ? !r.industry : r.industry === industry)) &&
      r.employees >= minSize)
    // "Most promising" is the order the server sent; the others re-sort, keeping that order among equals.
    const by: Record<Sort, (a: OtherLayoffRow, b: OtherLayoffRow) => number> = {
      best: () => 0,
      size: (a, b) => b.employees - a.employees,
      date: (a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0),
      state: (a, b) => (a.state ?? '~').localeCompare(b.state ?? '~'),
      industry: (a, b) => (a.industry ?? '~').localeCompare(b.industry ?? '~'),
    }
    return [...kept].sort(by[sort])
  }, [rows, sort, state, industry, minSize])

  if (rows.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Other layoffs ({shown.length}{shown.length !== rows.length ? ` of ${rows.length}` : ''})</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every recent layoff of 100 jobs or more that has no draft. The weekly cap and the credibility check only limit what is drafted
        automatically. Make a draft from any of these; the line in red says what looks off.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Sort by</span>
          <NativeSelect
            name="sort" aria-label="Sort by" placeholder="Most promising"
            options={SORTS.filter((x) => x.value !== 'best').map((x) => ({ value: x.value, label: x.label }))}
            onChange={(v) => setSort((v || 'best') as Sort)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">State</span>
          <NativeSelect
            name="state" aria-label="State" placeholder="All states"
            options={[...states.map((x) => ({ value: x, label: x })), { value: '__none', label: 'State unknown' }]}
            onChange={setState}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Industry</span>
          <NativeSelect
            name="industry" aria-label="Industry" placeholder="All industries"
            options={[...industries.map((x) => ({ value: x, label: x })), { value: '__none', label: 'Industry unknown' }]}
            onChange={setIndustry}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Size</span>
          <NativeSelect
            name="size" aria-label="Size" placeholder="Any size"
            options={MIN_SIZES.map((n) => ({ value: String(n), label: `${n.toLocaleString('en-US')} jobs or more` }))}
            onChange={(v) => setMinSize(Number(v) || 0)}
          />
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No layoffs match these filters. Clear a filter to see more.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border px-4">
          {shown.map((r) => <Row key={r.noticeId} r={r} />)}
        </ul>
      )}
    </section>
  )
}
