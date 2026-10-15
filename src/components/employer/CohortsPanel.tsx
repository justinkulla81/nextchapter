'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateCohortAction } from '@/app/employer/(app)/roster/actions'
import type { CohortSummary } from '@/lib/employer/outplacement-roster'

// The roster by cohort: counts, a link to see just that cohort, and one
// change for everyone in it (package, access end, name).
export function CohortsPanel({ cohorts, packages, current }: { cohorts: CohortSummary[]; packages: { key: string; name: string }[]; current: string | null }) {
  if (cohorts.length < 2 && !cohorts[0]?.cohort) {
    return <p className="text-sm text-muted-foreground">Group people into cohorts with a cohort column in your spreadsheet or HR feed (for example “March RIF, Austin”).</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            <th className="px-3 py-2 font-medium">Cohort</th>
            <th className="px-3 py-2 font-medium">Invited</th>
            <th className="px-3 py-2 font-medium">Joined</th>
            <th className="px-3 py-2 font-medium">Placed</th>
            <th className="px-3 py-2 font-medium">Removed</th>
            <th className="px-3 py-2 font-medium">Change everyone</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => {
            const key = c.cohort ?? ''
            const active = current === key
            return (
              <tr key={key || 'none'} className={`border-t border-border ${active ? 'bg-muted/40' : ''}`}>
                <td className="px-3 py-2">
                  <Link href={active ? '/employer/roster' : `/employer/roster?cohort=${encodeURIComponent(key)}`} className="font-medium underline-offset-4 hover:underline">
                    {c.cohort ?? 'No cohort'}
                  </Link>
                  {active && <span className="ml-2 text-xs text-muted-foreground">showing</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{c.invited}</td>
                <td className="px-3 py-2 tabular-nums">{c.joined}</td>
                <td className="px-3 py-2 tabular-nums">{c.placed}</td>
                <td className="px-3 py-2 tabular-nums">{c.removed}</td>
                <td className="px-3 py-2">{c.invited + c.joined > 0 ? <CohortChange cohort={key} named={!!c.cohort} packages={packages} /> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CohortChange({ cohort, named, packages }: { cohort: string; named: boolean; packages: { key: string; name: string }[] }) {
  const [pkg, setPkg] = useState(packages[0]?.key ?? 'all')
  const [ends, setEnds] = useState('')
  const [name, setName] = useState(cohort)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const [pending, start] = useTransition()
  const run = (change: Parameters<typeof updateCohortAction>[1], label: string) =>
    start(async () => {
      setMsg(null)
      const r = await updateCohortAction(cohort, change)
      setMsg(r.error ? { error: r.error } : { ok: `${label} for ${r.count} ${r.count === 1 ? 'person' : 'people'}.` })
    })
  return (
    <details className="text-xs" style={pending ? { cursor: 'wait' } : undefined}>
      <summary className="cursor-pointer text-muted-foreground">Change</summary>
      <div className="mt-2 w-72 space-y-3 rounded-md border border-border bg-card p-3">
        {packages.length > 1 && (
          <div className="space-y-1">
            <label htmlFor={`cp-${cohort}`} className="font-medium">Package</label>
            <div className="flex gap-1">
              <select id={`cp-${cohort}`} value={pkg} onChange={(e) => setPkg(e.target.value)} className="h-7 flex-1 rounded-md border border-input bg-background px-2">
                {packages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => run({ packageKey: pkg }, 'Package set')}>Set</Button>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor={`ce-${cohort}`} className="font-medium">Access ends</label>
          <div className="flex gap-1">
            <Input id={`ce-${cohort}`} type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className="h-7" />
            <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => run({ accessEnds: ends }, ends ? 'End date set' : 'Contract end used')}>Set</Button>
          </div>
          <p className="text-muted-foreground">Blank uses the contract’s end.</p>
        </div>
        {named && (
          <div className="space-y-1">
            <label htmlFor={`cn-${cohort}`} className="font-medium">Cohort name</label>
            <div className="flex gap-1">
              <Input id={`cn-${cohort}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-7" />
              <Button type="button" size="xs" variant="outline" disabled={pending || !name.trim() || name === cohort} onClick={() => run({ rename: name }, 'Renamed')}>Rename</Button>
            </div>
          </div>
        )}
        {msg?.error && <p className="text-destructive">{msg.error}</p>}
        {msg?.ok && <p className="text-brand">{msg.ok}</p>}
      </div>
    </details>
  )
}
