'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { cn } from '@/lib/utils'

const VIEWS = [
  { key: 'all', label: 'All jobs' },
  { key: 'fresh', label: 'Last 72 hours' },
  { key: 'low_competition', label: 'Low competition' },
] as const

/** Switches the job board between all jobs, fresh ones and low-competition ones (the `view` URL parameter). */
export function BoardViewToggle({ surface }: { surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = searchParams.get('view') ?? 'all'

  function select(view: string) {
    if (view === current) return
    const next = new URLSearchParams(searchParams.toString())
    if (view === 'all') next.delete('view')
    else next.set('view', view)
    posthog.capture('job_board_view_changed', { surface, view })
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  return (
    <div role="group" aria-label="Which jobs to show" className={cn('flex gap-1', pending && 'cursor-wait')}>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => select(v.key)}
          disabled={pending}
          aria-pressed={current === v.key}
          className={cn(
            'rounded-md border px-2 py-1 text-sm',
            current === v.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
            pending && 'cursor-wait'
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
