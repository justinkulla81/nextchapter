'use client'

import { useState } from 'react'
import type { Grade } from '@/lib/scoring/grade'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import { cn } from '@/lib/utils'

export interface ArchivedSnapshot {
  id: string
  weekStartDate: Date
  grade: Grade
  namedReasons: NamedReason[]
}

// Permanent, growing archive (Prompt 50) — every past snapshot is openable
// to view that week's full report (grade + named reasons) exactly as it
// looked at the time. Nothing here is ever overwritten or deleted.
export function MarketRealitySnapshotArchive({ snapshots }: { snapshots: ArchivedSnapshot[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your weekly Market Reality snapshots will show up here after your first archived week.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {snapshots.map((s) => {
        const isOpen = openId === s.id
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : s.id)}
              className="flex w-full items-center justify-between text-sm text-foreground"
            >
              <span>
                Week of {s.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="tabular-nums text-muted-foreground">{s.grade} {isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className={cn('mt-2 space-y-1 rounded-md bg-muted/40 p-3')}>
                {s.namedReasons.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No named reasons recorded for this week.</p>
                ) : (
                  s.namedReasons.map((reason) => (
                    <p key={reason.id} className="text-xs text-foreground">
                      <span className={reason.kind === 'gap' ? 'text-amber-700' : 'text-emerald-700'}>
                        {reason.kind === 'gap' ? 'Gap: ' : 'Strength: '}
                      </span>
                      {reason.text}
                    </p>
                  ))
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
