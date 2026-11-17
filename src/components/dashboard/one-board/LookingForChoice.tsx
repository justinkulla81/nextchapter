'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { workTypesParam } from '@/lib/jobs/work-type'
import { LOOKING_FOR, LOOKING_FOR_LABEL, workTypesFor, type LookingFor } from '@/lib/jobs/looking-for'
import { saveBoardWorkTypes } from '@/app/dashboard/find-my-job/my-jobs-actions'
import { boardHref } from '@/lib/jobs/board-url'

/**
 * "What are you looking for?" Full-time, fractional and independent work, or both, as three adjacent buttons. The choice goes in the
 * `types` URL parameter and is saved to the member's profile (saveBoardWorkTypes), so the board opens the same way next time.
 */
export function LookingForChoice({ selected }: { selected: LookingFor }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState<LookingFor>(selected)
  const [error, setError] = useState<string | null>(null)

  function choose(choice: LookingFor) {
    if (choice === current) return
    const previous = current
    setCurrent(choice)
    setError(null)
    const types = workTypesFor(choice)
    posthog.capture('board_looking_for_chosen', { choice, previous })
    startTransition(async () => {
      const saved = await saveBoardWorkTypes(types)
      if (!saved.ok) setError(`${saved.error} Your choice applies to this visit only.`)
      router.replace(boardHref(searchParams, { types: workTypesParam(types) }, { pathname }), { scroll: false })
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <span id="looking-for-label" className="text-sm font-medium text-ink">
        What are you looking for?
      </span>
      <div role="group" aria-labelledby="looking-for-label" className="flex flex-wrap gap-1">
        {LOOKING_FOR.map((c) => {
          const on = c === current
          return (
            <button
              key={c}
              type="button"
              onClick={() => choose(c)}
              aria-pressed={on}
              aria-busy={pending}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted',
                pending && 'cursor-wait'
              )}
            >
              {LOOKING_FOR_LABEL[c]}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="status" className="w-full text-xs text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  )
}
