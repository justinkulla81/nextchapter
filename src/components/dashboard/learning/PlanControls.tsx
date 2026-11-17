'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { CourseLink } from '@/components/dashboard/CourseLink'
import { PLAN_STATUSES } from '@/lib/learning/plan'
import { addToPlan, removeFromPlan, setPlanStatus, type PlanResult } from '@/app/dashboard/learning/plan-actions'

const SECONDARY = 'h-10 rounded-full border border-border bg-background px-5 text-sm font-medium text-ink hover:bg-muted'

function Err({ r }: { r: PlanResult }) {
  return r?.error ? (
    <p role="alert" className="text-sm text-destructive">
      {r.error}
    </p>
  ) : null
}

export type PlanEntryView = { id: string; title: string; provider: string; url: string; status: string; createdAt: Date }

// "Add to my plan" on a course. Once it is in the plan the button gives way to a quiet "In your plan".
export function AddToPlanButton({ title, provider, url, slot, inPlan }: { title: string; provider: string; url: string; slot: 'featured' | 'more'; inPlan: boolean }) {
  const [state, action] = useActionState<PlanResult, FormData>(addToPlan, undefined)
  if (inPlan) return <span className="text-sm font-medium text-success">In your plan</span>
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="url" value={url} />
      <input type="hidden" name="slot" value={slot} />
      <SubmitButton variant="outline" className={SECONDARY} pendingLabel="Adding…" savedLabel="Added">
        Add to my plan
      </SubmitButton>
      <Err r={state} />
    </form>
  )
}

// One course in the plan: the title opens the course, three adjacent buttons set where you are, and Remove asks first.
export function PlanRow({ entry }: { entry: PlanEntryView }) {
  const [status, setStatus] = useActionState<PlanResult, FormData>(setPlanStatus, undefined)
  const [removed, remove] = useActionState<PlanResult, FormData>(removeFromPlan, undefined)
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-base font-semibold text-ink">
          <CourseLink href={entry.url} partnerName={entry.provider} title={entry.title} slot="plan" hasReason={false} className="underline-offset-4 hover:underline">
            {entry.title}
          </CourseLink>
        </p>
        <p className="text-sm text-muted-foreground">{entry.provider}</p>
        <Err r={status} />
        <Err r={removed} />
      </div>
      <form action={setStatus} className="flex items-center gap-1" role="group" aria-label={`Where you are with ${entry.title}`}>
        <input type="hidden" name="id" value={entry.id} />
        {PLAN_STATUSES.map((s) => (
          <SubmitButton
            key={s.key}
            name="status"
            value={s.key}
            variant="outline"
            aria-pressed={entry.status === s.key}
            savedLabel={s.label}
            className={cn('h-9 rounded-full px-4 text-sm', entry.status === s.key ? 'border-ink bg-ink text-white hover:bg-ink' : 'border-border bg-background text-ink hover:bg-muted')}
          >
            {s.label}
          </SubmitButton>
        ))}
      </form>
      <form
        action={remove}
        onSubmit={(e) => {
          if (!window.confirm(`Remove “${entry.title}” from your plan?`)) e.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={entry.id} />
        <SubmitButton variant="ghost" className="h-9 rounded-full px-3 text-sm text-muted-foreground" pendingLabel="Removing…" savedLabel="Removed">
          Remove
        </SubmitButton>
      </form>
    </li>
  )
}
