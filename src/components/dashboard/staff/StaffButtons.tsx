'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { setInternalRoleInterest } from '@/app/dashboard/internal-roles/actions'
import { setCompanyCourseStatus, type CourseStatus } from '@/app/dashboard/company-courses/actions'

export function InterestButton({ postingId, orgName, interested }: { postingId: string; orgName: string; interested: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const run = (want: boolean) =>
    start(async () => {
      setError(null)
      const r = await setInternalRoleInterest(postingId, want, want ? note : undefined)
      if (r.error) setError(r.error)
      else setOpen(false)
    })

  if (interested) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-brand">You told {orgName} you’re interested.</p>
        <button type="button" disabled={pending} onClick={() => run(false)} className={cn('text-sm text-muted-foreground underline underline-offset-4', pending && 'cursor-wait')}>
          {pending ? 'Taking it back…' : 'Take it back'}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        I’m interested
      </button>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm">
        This shares your name and email with {orgName} for this role, and nothing else from NextChapter.
      </p>
      <label htmlFor={`note-${postingId}`} className="text-xs text-muted-foreground">
        A note to go with it (optional)
      </label>
      <Textarea id={`note-${postingId}`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this role, and when you could move." />
      <div className="flex items-center gap-3">
        <button type="button" disabled={pending} onClick={() => run(true)} className={cn('rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90', pending && 'cursor-wait')}>
          {pending ? 'Sharing…' : `Share my name with ${orgName}`}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground underline underline-offset-4">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

const STATUS_OPTIONS: { value: CourseStatus; label: string }[] = [
  { value: 'NONE', label: 'Not started' },
  { value: 'STARTED', label: 'Started' },
  { value: 'COMPLETED', label: 'Finished' },
]

export function CourseStatusButtons({ courseId, title, status }: { courseId: string; title: string; status: CourseStatus }) {
  const [pending, start] = useTransition()
  const [value, setValue] = useState<CourseStatus>(status)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-1">
      <div role="radiogroup" aria-label={`Your progress on ${title}`} className={cn('inline-flex flex-wrap gap-1', pending && 'cursor-wait')}>
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const prev = value
                setValue(o.value)
                setError(null)
                const r = await setCompanyCourseStatus(courseId, o.value)
                if (r.error) {
                  setValue(prev)
                  setError(r.error)
                }
              })
            }
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              value === o.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
              pending && 'cursor-wait'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
