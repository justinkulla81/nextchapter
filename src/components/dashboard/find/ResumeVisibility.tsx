'use client'

import { useState, useTransition } from 'react'
import { setResumeBookOptIn } from '@/app/dashboard/privacy/actions'
import { posthog } from '@/lib/posthog/client'
import { resumeBookCopy } from '@/lib/jobs/find-resources'
import { cn } from '@/lib/utils'

// Who can see the résumé: two options, so two adjacent buttons. The choice saves on click, says it saved, and puts the
// previous choice back with a message if the save fails. The cursor shows it is working while the save runs.
const OPTIONS = [
  { value: true, label: 'Yes, include my résumé' },
  { value: false, label: 'No, keep it private' },
] as const

export function ResumeVisibility({ optedIn }: { optedIn: boolean }) {
  const [value, setValue] = useState(optedIn)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const copy = resumeBookCopy(value)

  function choose(next: boolean) {
    if (next === value || pending) return
    const previous = value
    setValue(next)
    setStatus('idle')
    startTransition(async () => {
      try {
        await setResumeBookOptIn(next)
        posthog.capture('resume_book_visibility_changed', { optedIn: next, source: 'find_resources' })
        setStatus('saved')
      } catch {
        setValue(previous)
        setStatus('error')
      }
    })
  }

  return (
    <div className={cn('space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="text-base text-ink">
        <span className="font-semibold">{copy.state}</span> <span className="text-muted-foreground">{copy.effect}</span>
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Résumé visibility">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => choose(o.value)}
            className={cn(
              'rounded-full border px-5 py-2 text-sm font-medium',
              value === o.value ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="min-h-5 text-sm" role="status">
        {pending && <span className="text-muted-foreground">Saving…</span>}
        {!pending && status === 'saved' && <span className="text-success">Saved. You can change this any time.</span>}
        {!pending && status === 'error' && <span className="text-destructive">We could not save that, so nothing changed. Try again in a moment.</span>}
      </p>
    </div>
  )
}
