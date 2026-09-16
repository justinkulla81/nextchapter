'use client'

import { useState, useTransition } from 'react'
import { autoMergeExactDuplicates } from '@/app/support/admin/(portal)/crm/actions'

/**
 * One button, one confirmation, for the whole batch — not a click per pair.
 * Only merges people who already share an exact signal (email, or the same
 * name+org this app already treats as "the same person" when creating a
 * record), so there's nothing ambiguous left for a human to weigh in on.
 */
export function CrmAutoMergeButton() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Merge every exact-duplicate person (same email, or same name + organization)? This can\'t be undone.')) return
          start(async () => {
            const r = await autoMergeExactDuplicates()
            setResult(r.merged > 0 ? `Merged ${r.merged} duplicate${r.merged === 1 ? '' : 's'} across ${r.groups} group${r.groups === 1 ? '' : 's'}.` : 'No exact duplicates found.')
          })
        }}
        className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        {pending ? 'Merging…' : 'Merge exact duplicates'}
      </button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  )
}
