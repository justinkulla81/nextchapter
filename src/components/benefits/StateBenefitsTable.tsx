'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePostHog } from 'posthog-js/react'

export interface BenefitsRow {
  code: string
  name: string
  slug: string
  maxWeekly: number | null
  minWeekly: number | null
  maxWeeks: number | null
  durationVaries: boolean | null
  waitingWeek: boolean | null
}

type Key = 'name' | 'maxWeekly' | 'minWeekly' | 'maxWeeks'

const COLUMNS: { key: Key; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'State', numeric: false },
  { key: 'maxWeekly', label: 'Max weekly benefit', numeric: true },
  { key: 'minWeekly', label: 'Min weekly benefit', numeric: true },
  { key: 'maxWeeks', label: 'Max weeks', numeric: true },
]

const usd = (n: number | null) => (n == null ? 'Check with state' : `$${n.toLocaleString()}`)

/**
 * Every state's headline benefit figures, sortable by any column. Unknown
 * values sort last in both directions and read "Check with state".
 */
export function StateBenefitsTable({ rows }: { rows: BenefitsRow[] }) {
  const posthog = usePostHog()
  const [sort, setSort] = useState<{ key: Key; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })

  const sorted = useMemo(() => {
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = a[sort.key]
      const y = b[sort.key]
      if (x == null && y == null) return a.name.localeCompare(b.name)
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sign
    })
  }, [rows, sort])

  const toggle = (key: Key) => {
    const dir = sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc'
    setSort({ key, dir })
    posthog?.capture('benefits_table_sorted', { column: key, direction: dir })
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">Unemployment benefits by state. Select a column heading to sort.</caption>
        <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={`px-4 py-3 font-medium ${c.numeric ? 'text-right' : ''}`}
              >
                <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-foreground">
                  {c.label}
                  <span aria-hidden="true">{sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
            ))}
            <th scope="col" className="px-4 py-3 font-medium">Waiting week</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr key={r.code}>
              <th scope="row" className="px-4 py-3 font-medium">
                <Link href={`/unemployment-benefits/${r.slug}`} className="text-navy hover:text-brand hover:underline">{r.name}</Link>
              </th>
              <td className="px-4 py-3 text-right tabular-nums">{usd(r.maxWeekly)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{usd(r.minWeekly)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.maxWeeks ?? 'Check with state'}
                {r.durationVaries && <span className="block text-xs text-muted-foreground">varies with unemployment rate</span>}
              </td>
              <td className="px-4 py-3">{r.waitingWeek == null ? 'Check with state' : r.waitingWeek ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
