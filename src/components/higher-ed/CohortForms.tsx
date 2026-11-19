'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmActionButton } from './ConfirmActionButton'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { EXPERIENCE_BANDS } from '@/lib/workforce/training-rules'
import { WEEKS_OPTIONS } from '@/lib/workforce/talent-cohorts'
import { createCohort, deleteCohort, postCohortUpdate, type CohortResult } from '@/app/i/[slug]/(portal)/cohort-actions'

function Note({ state }: { state: CohortResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>
  if (state?.ok && state.message) return <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
  return null
}

export function NewCohortForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<CohortResult, FormData>(createCohort.bind(null, slug), undefined)
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="c-name">Name of the cohort</Label><Input id="c-name" name="name" required maxLength={80} placeholder="Operations managers" /></div>
        <div className="space-y-1"><Label htmlFor="c-purpose">What it is for (optional)</Label><Input id="c-purpose" name="purpose" maxLength={300} placeholder="People we can place in logistics roles this quarter" /></div>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Experience</legend>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_BANDS.map((b) => (
            <label key={b} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="checkbox" name="levels" value={b} className="size-4" />
              {b}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Time out of work</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <input type="radio" name="minWeeksOut" value="" defaultChecked className="size-4" />
            Any
          </label>
          {WEEKS_OPTIONS.map((w) => (
            <label key={w} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="minWeeksOut" value={w} className="size-4" />
              {w} weeks or more
            </label>
          ))}
        </div>
      </fieldset>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Function</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
            <label key={fn} className="flex items-center gap-2 text-sm"><input type="checkbox" name="functions" value={fn} className="size-4" />{fn}</label>
          ))}
        </div>
      </details>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Industry</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {INDUSTRY_BUCKET_NAMES.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm"><input type="checkbox" name="industries" value={n} className="size-4" />{n}</label>
          ))}
        </div>
      </details>
      <p className="text-xs text-muted-foreground">Leave a group empty to include everyone in it. The cohort fills on its own as people who fit join.</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Starting…">Start the cohort</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function CohortPostForm({ slug, cohortId }: { slug: string; cohortId: string }) {
  const [state, action] = useActionState<CohortResult, FormData>(postCohortUpdate.bind(null, slug, cohortId), undefined)
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor={`cp-${cohortId}`}>Post an update to the people in this cohort</Label>
      <textarea id={`cp-${cohortId}`} name="body" required maxLength={1500} rows={3} className="w-full rounded-md border border-border bg-background p-2 text-sm" placeholder="A hiring event for operations managers is Dec 9 at the job center. Bring a résumé." />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Posting…">Post the update</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function DeleteCohortButton({ slug, cohortId, name }: { slug: string; cohortId: string; name: string }) {
  return <ConfirmActionButton label="Delete the cohort" confirm={`Delete “${name}” and its updates? Nobody is removed from the program.`} confirmLabel="Yes, delete it" variant="outline" run={() => deleteCohort(slug, cohortId)} />
}
