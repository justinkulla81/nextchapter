'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { WORK_TYPES, WORK_TYPE_LABEL, workTypesParam, type WorkType } from '@/lib/jobs/work-type'
import { saveBoardWorkTypes } from '@/app/dashboard/find-my-job/my-jobs-actions'
import { boardHref } from '@/lib/jobs/board-url'

/**
 * The four kinds of work on the one board, as multi-select adjacent buttons. The
 * choice goes in the `types` URL parameter (so a reload or shared link keeps it)
 * and is saved to the member's profile so the board opens the same way next time.
 */
export function WorkTypeToggle({ selected, counts }: { selected: WorkType[]; counts?: Partial<Record<WorkType, number>> }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState<WorkType[]>(selected)
  const [note, setNote] = useState<string | null>(null)

  function toggle(type: WorkType) {
    const next = current.includes(type) ? current.filter((t) => t !== type) : WORK_TYPES.filter((t) => t === type || current.includes(t))
    if (next.length === 0) {
      setNote('Keep at least one kind of work on. To see only this other kind, turn that one on first.')
      return
    }
    setNote(null)
    setCurrent(next)
    const href = boardHref(searchParams, { types: workTypesParam(next) }, { pathname })
    posthog.capture('board_work_type_toggled', { types: next, toggled: type, on: next.includes(type) })
    startTransition(async () => {
      const saved = await saveBoardWorkTypes(next)
      if (!saved.ok) setNote(saved.error)
      router.replace(href, { scroll: false })
    })
  }

  return (
    <div className="space-y-1">
      <div role="group" aria-label="Kinds of work to show" className={cn('flex flex-wrap gap-1', pending && 'cursor-wait')}>
        {WORK_TYPES.map((t) => {
          const on = current.includes(t)
          const n = counts?.[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-pressed={on}
              aria-busy={pending}
              className={cn(
                'rounded-md border px-2.5 py-1 text-sm',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
                pending && 'cursor-wait'
              )}
            >
              {WORK_TYPE_LABEL[t]}
              {typeof n === 'number' && <span className={cn('ml-1 text-xs', on ? 'opacity-80' : 'text-muted-foreground')}>{n.toLocaleString()}</span>}
            </button>
          )
        })}
      </div>
      {note && (
        <p role="status" className="text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  )
}
