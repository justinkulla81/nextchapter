'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { submitScholarshipApplication } from '@/app/dashboard/plans/scholarship/actions'

export function ScholarshipApplicationForm() {
  const [state, formAction, pending] = useActionState(submitScholarshipApplication, undefined)

  if (state?.submitted) {
    return (
      <div className="space-y-1 rounded-xl border border-light-gray bg-off-white p-6 text-center">
        <p className="font-semibold text-navy">Thanks for sharing that.</p>
        <p className="text-sm text-muted-foreground">
          A real person reviews every application — we&apos;ll follow up by email once we have.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="space-y-1.5">
        <Label htmlFor="story">What&apos;s going on?</Label>
        <Textarea
          id="story"
          name="story"
          rows={6}
          placeholder="Share whatever feels relevant — there's no right way to answer this."
          aria-invalid={!!state?.error}
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  )
}
