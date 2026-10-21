'use client'

import { useActionState, useState } from 'react'
import { saveEducation, type EducationFormState } from '@/app/dashboard/early-career/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { DEGREE_CHOICES } from '@/lib/early-career/education-form'
import type { EducationSummary } from '@/lib/early-career/data'
import { cn } from '@/lib/utils'

// School, degree, major and graduation year in one short form. Writes the
// member's primary education entry, which also links them to their alumni.
export function EducationForm({ initial }: { initial: EducationSummary | null }) {
  const [state, formAction, pending] = useActionState<EducationFormState, FormData>(saveEducation, undefined)
  const initialDegree = initial?.degree && (DEGREE_CHOICES as readonly string[]).includes(initial.degree) ? initial.degree : initial ? 'Other' : "Bachelor's"
  const [degree, setDegree] = useState<string>(initialDegree)

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <input type="hidden" name="degree" value={degree} />
      <div className="space-y-2">
        <Label htmlFor="ec-school">School</Label>
        <Input id="ec-school" name="schoolName" required defaultValue={initial?.schoolName ?? ''} placeholder="e.g. Ohio State University" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Degree</legend>
        <div className="flex flex-wrap gap-2">
          {DEGREE_CHOICES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={degree === d}
              onClick={() => setDegree(d)}
              className={cn(
                'rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors',
                degree === d ? 'border-ink bg-ink/5 text-ink' : 'border-border bg-white hover:border-ink/40'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-2">
          <Label htmlFor="ec-major">Major or field of study</Label>
          <Input id="ec-major" name="fieldOfStudy" defaultValue={initial?.fieldOfStudy ?? ''} placeholder="e.g. Economics" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ec-year">Graduation year</Label>
          <Input id="ec-year" name="graduationYear" type="number" inputMode="numeric" defaultValue={initial?.graduationYear ?? ''} placeholder="e.g. 2026" />
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton pendingLabel="Saving…">Save my school</SubmitButton>
    </form>
  )
}
