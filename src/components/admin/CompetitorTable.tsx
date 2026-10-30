'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { setCompetitorFlags } from '@/app/support/admin/(portal)/vision/actions'

export interface CompetitorRow {
  id: string
  name: string
  url: string | null
  relationship: string
  keyCompetitor: boolean
  category: string | null
  areas: string[]
  status: string
  headcount: number | null
  revenueUsd: number | null
  revenueNote: string | null
  monthlyVisits: number | null
  trafficNote: string | null
  fundingRaisedUsd: number | null
  lastRound: string | null
  investors: string | null
  /** Booths, sponsorships, speaking slots and podcasts we have on file. */
  presence: number
  foundedYear: number | null
  hq: string | null
  reviewedAt: string | null
  needsReview: boolean
}

type SortKey = 'key' | 'name' | 'relationship' | 'category' | 'headcount' | 'revenueUsd' | 'monthlyVisits' | 'fundingRaisedUsd' | 'presence' | 'foundedYear' | 'reviewedAt'
interface Option { key: string; label: string }

const REL_STYLE: Record<string, string> = {
  DIRECT: 'bg-red-500/10 text-red-700 dark:text-red-300',
  ADJACENT: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  PARTNER: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SUPPLIER: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  NOT_A_COMPETITOR: 'bg-muted text-muted-foreground',
}
const REL_ORDER = ['DIRECT', 'ADJACENT', 'PARTNER', 'SUPPLIER', 'NOT_A_COMPETITOR']

function compact(n: number | null, dollars = false): string {
  if (n == null) return '—'
  const p = dollars ? '$' : ''
  if (n >= 1e9) return `${p}${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`
  if (n >= 1e6) return `${p}${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `${p}${Math.round(n / 1e3)}K`
  return `${p}${n}`
}

const select = 'h-8 rounded-md border border-input bg-transparent px-2 text-sm'

/**
 * Every competitor in one table that sorts on any number column and filters by search, relationship, market, area
 * and which numbers we have. Runs in the browser over rows the page already loaded, so there is no round trip.
 * A missing number always sorts last, whichever way the column is sorted.
 */
export function CompetitorTable({ rows: serverRows, relationships, categories, areas }: { rows: CompetitorRow[]; relationships: Option[]; categories: Option[]; areas: Option[] }) {
  // Flag changes show at once; the server save follows, and a failed save puts the row back and says why.
  const [overrides, setOverrides] = useState<Record<string, Partial<Pick<CompetitorRow, 'relationship' | 'keyCompetitor'>>>>({})
  const [keyOnly, setKeyOnly] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const rows = useMemo(() => serverRows.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r)), [serverRows, overrides])
  const flag = (r: CompetitorRow, change: { relationship?: string; keyCompetitor?: boolean }) => {
    const before = { relationship: r.relationship, keyCompetitor: r.keyCompetitor }
    setMessage(null)
    setOverrides((o) => ({ ...o, [r.id]: { ...o[r.id], ...change } }))
    posthog.capture('competitor_flagged', { competitorId: r.id, ...change, from: before.relationship })
    startTransition(async () => {
      const res = await setCompetitorFlags(r.id, change)
      if (!res.ok) {
        setOverrides((o) => ({ ...o, [r.id]: { ...o[r.id], ...before } }))
        setMessage(`${r.name}: ${res.error ?? 'could not save'}`)
      }
    })
  }
  const [q, setQ] = useState('')
  const [rel, setRel] = useState('')
  const [cat, setCat] = useState('')
  const [area, setArea] = useState('')
  const [only, setOnly] = useState<'' | 'revenue' | 'traffic' | 'people' | 'all3' | 'missing'>('')
  const [gone, setGone] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'revenueUsd', dir: -1 })

  const track = (control: string, value: string) => posthog.capture('competitor_table_filtered', { control, value, rows: rows.length })

  const catLabel = useMemo(() => new Map(categories.map((c) => [c.key, c.label])), [categories])
  const relLabel = useMemo(() => new Map(relationships.map((c) => [c.key, c.label])), [relationships])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = rows.filter((r) =>
      (!needle || r.name.toLowerCase().includes(needle) || (r.hq ?? '').toLowerCase().includes(needle) || (r.url ?? '').toLowerCase().includes(needle)) &&
      (rel ? r.relationship === rel : r.relationship !== 'NOT_A_COMPETITOR') && (!keyOnly || r.keyCompetitor) && (!cat || r.category === cat) && (!area || r.areas.includes(area)) &&
      (gone || r.status === 'ACTIVE') &&
      (only === '' ||
        (only === 'revenue' && r.revenueUsd != null) || (only === 'traffic' && r.monthlyVisits != null) || (only === 'people' && r.headcount != null) ||
        (only === 'all3' && r.revenueUsd != null && r.monthlyVisits != null && r.headcount != null) ||
        (only === 'missing' && (r.revenueUsd == null || r.monthlyVisits == null || r.headcount == null))),
    )
    const val = (r: CompetitorRow): number | string | null => {
      if (sort.key === 'key') return r.keyCompetitor ? 0 : 1
      if (sort.key === 'name') return r.name.toLowerCase()
      if (sort.key === 'relationship') return REL_ORDER.indexOf(r.relationship)
      if (sort.key === 'category') return catLabel.get(r.category ?? '') ?? null
      return r[sort.key]
    }
    return out.sort((a, b) => {
      const x = val(a), y = val(b)
      if (x == null && y == null) return a.name.localeCompare(b.name)
      if (x == null) return 1
      if (y == null) return -1
      const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y)
      return c * sort.dir || a.name.localeCompare(b.name)
    })
  }, [rows, q, rel, keyOnly, cat, area, only, gone, sort, catLabel])

  const head = (key: SortKey, label: string, right = false) => {
    const on = sort.key === key
    return (
      <th scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`whitespace-nowrap px-2 py-2 font-medium ${right ? 'text-right' : 'text-left'}`}>
        <button type="button" onClick={() => { const next = on ? { key, dir: (sort.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: (key === 'name' || key === 'category' || key === 'relationship' ? 1 : -1) as 1 | -1 }; setSort(next); posthog.capture('competitor_table_sorted', { key, dir: next.dir === 1 ? 'asc' : 'desc' }) }} className="inline-flex items-center gap-1 hover:underline">
          {label}<span aria-hidden className={on ? '' : 'opacity-30'}>{on ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  const total = (pick: (r: CompetitorRow) => number | null) => shown.reduce((s, r) => s + (pick(r) ?? 0), 0)
  const have = (pick: (r: CompetitorRow) => number | null) => shown.filter((r) => pick(r) != null).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, site or city" aria-label="Search competitors" className="h-8 w-56 rounded-md border border-input bg-transparent px-2 text-sm" />
        <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Relationship">
          <button type="button" onClick={() => { setRel(''); track('relationship', 'all') }} aria-pressed={!rel} className={`rounded-md border px-2.5 py-1 text-xs ${!rel ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>All</button>
          {relationships.map((r) => <button key={r.key} type="button" onClick={() => { setRel(rel === r.key ? '' : r.key); track('relationship', r.key) }} aria-pressed={rel === r.key} className={`rounded-md border px-2.5 py-1 text-xs ${rel === r.key ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>{r.label}</button>)}
        </div>
        <select value={cat} onChange={(e) => { setCat(e.target.value); track('market', e.target.value) }} aria-label="Market" className={select}>
          <option value="">Every market</option>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={area} onChange={(e) => { setArea(e.target.value); track('area', e.target.value) }} aria-label="Where they compete" className={select}>
          <option value="">Every area</option>
          {areas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        <select value={only} onChange={(e) => { setOnly(e.target.value as typeof only); track('numbers', e.target.value) }} aria-label="Which numbers we have" className={select}>
          <option value="">Any numbers</option>
          <option value="revenue">Has revenue</option>
          <option value="traffic">Has traffic</option>
          <option value="people">Has headcount</option>
          <option value="all3">Has all three</option>
          <option value="missing">Missing at least one</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={gone} onChange={(e) => setGone(e.target.checked)} /> Include acquired / closed</label>
        <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={keyOnly} onChange={(e) => { setKeyOnly(e.target.checked); track('key_only', String(e.target.checked)) }} /> Key competitors only ★</label>
        {(q || rel || cat || area || only || gone || keyOnly) && <button type="button" onClick={() => { setQ(''); setRel(''); setCat(''); setArea(''); setOnly(''); setGone(false); setKeyOnly(false) }} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Clear ✕</button>}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">{shown.length} of {rows.length}</span>
      </div>

      {message && <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/5 p-2 text-sm">{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-border" aria-busy={pending}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {head('key', '★')}
              {head('name', 'Company')}
              {head('relationship', 'Relationship')}
              {head('category', 'Market')}
              {head('headcount', 'People', true)}
              {head('revenueUsd', 'Revenue / yr', true)}
              {head('monthlyVisits', 'Visits / mo', true)}
              {head('fundingRaisedUsd', 'Raised', true)}
              <th scope="col" className="whitespace-nowrap px-2 py-2 text-left font-medium">Last round</th>
              {head('presence', 'Events & podcasts', true)}
              {head('foundedYear', 'Founded', true)}
              {head('reviewedAt', 'Reviewed')}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-2 py-1.5 text-center">
                  <button type="button" onClick={() => flag(r, { keyCompetitor: !r.keyCompetitor })} aria-pressed={r.keyCompetitor} aria-label={r.keyCompetitor ? `Remove ${r.name} from key competitors` : `Mark ${r.name} as a key competitor`} title={r.keyCompetitor ? 'Key competitor. Click to remove.' : 'Click to mark as a key competitor'} className={`text-base leading-none ${r.keyCompetitor ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-500'}`}>{r.keyCompetitor ? '★' : '☆'}</button>
                </td>
                <td className="px-2 py-1.5">
                  <Link href={`/support/admin/vision/competitors?focus=${r.id}#c-${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" aria-label={`${r.name} website`} className="ml-1 text-muted-foreground hover:text-foreground">↗</a>}
                  {r.needsReview && <span className="ml-1.5 rounded bg-orange/15 px-1 text-[10px] uppercase text-orange" title="A draft read from a website; check it">draft</span>}
                  {r.status !== 'ACTIVE' && <span className="ml-1.5 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">{r.status.toLowerCase().replace('_', ' ')}</span>}
                </td>
                <td className="px-2 py-1.5">
                  <select value={r.relationship} onChange={(e) => flag(r, { relationship: e.target.value })} aria-label={`Relationship for ${r.name}`} className={`rounded-full border-0 px-2 py-0.5 text-xs ${REL_STYLE[r.relationship] ?? ''}`}>
                    {relationships.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{catLabel.get(r.category ?? '') ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.headcount != null ? r.headcount.toLocaleString() : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" title={r.revenueNote ?? undefined}>{compact(r.revenueUsd, true)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" title={r.trafficNote ?? undefined}>{compact(r.monthlyVisits)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{compact(r.fundingRaisedUsd, true)}</td>
                <td className="max-w-[14rem] truncate px-2 py-1.5 text-xs text-muted-foreground" title={[r.lastRound, r.investors && `Investors: ${r.investors}`].filter(Boolean).join('\n') || undefined}>{r.lastRound ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.presence || '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.foundedYear ?? '—'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted-foreground">{r.reviewedAt ? r.reviewedAt.slice(0, 10) : 'never'}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={12} className="px-2 py-6 text-center text-muted-foreground">No competitors match these filters.</td></tr>}
          </tbody>
          {shown.length > 0 && (
            <tfoot className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <td className="px-2 py-1.5" colSpan={3}>Shown ({shown.length}); totals count only rows with a figure</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{total((r) => r.headcount).toLocaleString()} <span className="opacity-60">({have((r) => r.headcount)})</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{compact(total((r) => r.revenueUsd), true)} <span className="opacity-60">({have((r) => r.revenueUsd)})</span></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{compact(total((r) => r.monthlyVisits))} <span className="opacity-60">({have((r) => r.monthlyVisits)})</span></td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Hover a revenue or visits figure for where it came from. Revenue and traffic are estimates unless the note says reported; a dash means we have no sourced figure.</p>
    </div>
  )
}
