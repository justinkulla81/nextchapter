'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { setChecklistItem } from '@/app/dashboard/early-career/actions'
import type { ChecklistRow } from '@/lib/early-career/checklist'
import { cn } from '@/lib/utils'

// The first-job / early-career checklist. Items the profile already proves
// (school added, résumé uploaded) show as done and can't be unchecked here;
// the rest the member checks off. `compact` is the home-page version: the
// next three open items only.
export function EarlyCareerChecklist({ rows, compact = false }: { rows: ChecklistRow[]; compact?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(rows, (state, change: { id: string; done: boolean }) =>
    state.map((r) => (r.id === change.id ? { ...r, done: change.done } : r))
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(row: ChecklistRow) {
    if (row.auto) return
    setError(null)
    startTransition(async () => {
      setOptimistic({ id: row.id, done: !row.done })
      const res = await setChecklistItem(row.id, !row.done)
      if (res.error) setError(res.error)
    })
  }

  const shown = compact ? optimistic.filter((r) => !r.done).slice(0, 3) : optimistic

  return (
    <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <ul className="space-y-3">
        {shown.map((row) => (
          <li key={row.id} className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => toggle(row)}
              disabled={row.auto}
              aria-pressed={row.done}
              aria-label={row.auto ? `${row.title}: done, from your profile` : row.done ? `Mark “${row.title}” not done` : `Mark “${row.title}” done`}
              title={row.auto ? 'Done: we can see this on your profile' : undefined}
              className="mt-0.5 shrink-0 rounded-full text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
            >
              {row.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', row.done && 'text-muted-foreground line-through')}>{row.title}</p>
              {!row.done && <p className="text-sm text-muted-foreground">{row.why}</p>}
              {!row.done && (
                <Link href={row.href} className="text-sm font-medium text-brand underline underline-offset-4">
                  {row.linkLabel}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      {compact && shown.length === 0 && <p className="text-sm text-muted-foreground">Every step is done. Nice work.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
