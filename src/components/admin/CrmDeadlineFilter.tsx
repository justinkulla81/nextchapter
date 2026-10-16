'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string; href: string }

// Adjacent buttons for the deadline filter on All leads. The page is a server
// component and the filter lives in the URL, so a choice navigates; it also
// records crm_leads_deadline_filter_changed with the view it was chosen from.
export function CrmDeadlineFilter({
  current, options, context,
}: {
  current: string
  options: Option[]
  context: { pipeline: string; status: string; sort: string; dir: string; totalBefore: number }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(o: Option) {
    if (o.value === current) return
    posthog.capture('crm_leads_deadline_filter_changed', {
      filter: 'deadline', value: o.value || 'any', previous: current || 'any',
      pipeline: context.pipeline || null, status: context.status,
      sort: context.sort, dir: context.dir, resultsBefore: context.totalBefore,
    })
    startTransition(() => router.push(o.href))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1 text-sm', pending && 'cursor-wait')} role="group" aria-label="Deadline filter">
      <span className="mr-1 text-muted-foreground">Deadline</span>
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => choose(o)} disabled={pending}
          aria-pressed={current === o.value}
          className={cn(
            'rounded-md border px-2.5 py-1',
            pending && 'cursor-wait',
            current === o.value ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
