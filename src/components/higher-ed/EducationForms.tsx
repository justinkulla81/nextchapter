'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TRAINING_SOURCES, EXPERIENCE_BANDS } from '@/lib/workforce/training-rules'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { archiveOffering, importCollegeProgram, saveOffering, setAssignment, type EducationResult } from '@/app/i/[slug]/(portal)/education-actions'

export type OfferingView = {
  id: string; source: string; title: string; provider: string | null; url: string | null; summary: string | null; skills: string[]
  industries: string[]; functions: string[]; levels: string[]; hours: number | null; priceCents: number; wioaEligible: boolean; ncCustom: boolean; assignment: string
}

function Note({ state }: { state: EducationResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>
  if (state?.ok && state.message) return <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
  return null
}

// Checkboxes for who a training is for. Nothing ticked means everyone.
function AudiencePicker({ industries = [], functions = [], levels = [] }: { industries?: string[]; functions?: string[]; levels?: string[] }) {
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Experience</legend>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_BANDS.map((b) => (
            <label key={b} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="checkbox" name="levels" value={b} defaultChecked={levels.includes(b)} className="size-4" />
              {b}
            </label>
          ))}
        </div>
      </fieldset>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Function{functions.length ? ` (${functions.length} chosen)` : ''}</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
            <label key={fn} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="functions" value={fn} defaultChecked={functions.includes(fn)} className="size-4" />
              {fn}
            </label>
          ))}
        </div>
      </details>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Industry{industries.length ? ` (${industries.length} chosen)` : ''}</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {INDUSTRY_BUCKET_NAMES.map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="industries" value={n} defaultChecked={industries.includes(n)} className="size-4" />
              {n}
            </label>
          ))}
        </div>
      </details>
      <p className="text-xs text-muted-foreground">Leave a group empty to include everyone in it.</p>
    </div>
  )
}

export function OfferingForm({ slug, offering }: { slug: string; offering?: OfferingView }) {
  const [state, action] = useActionState<EducationResult, FormData>(saveOffering.bind(null, slug, offering?.id ?? null), undefined)
  const o = offering
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Where it comes from</legend>
        <div className="flex flex-wrap gap-2">
          {TRAINING_SOURCES.map((s) => (
            <label key={s.key} title={s.hint} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="source" value={s.key} defaultChecked={(o?.source ?? 'THIRD_PARTY') === s.key} className="size-4" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`t-${o?.id ?? 'new'}`}>Name of the training</Label><Input id={`t-${o?.id ?? 'new'}`} name="title" defaultValue={o?.title ?? ''} required maxLength={160} /></div>
        <div className="space-y-1"><Label htmlFor={`p-${o?.id ?? 'new'}`}>Offered by</Label><Input id={`p-${o?.id ?? 'new'}`} name="provider" defaultValue={o?.provider ?? ''} maxLength={120} placeholder="University of Louisville, Coursera, NextChapter…" /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor={`u-${o?.id ?? 'new'}`}>Link to sign up or learn more</Label><Input id={`u-${o?.id ?? 'new'}`} name="url" defaultValue={o?.url ?? ''} maxLength={500} placeholder="https://" /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor={`s-${o?.id ?? 'new'}`}>What it is, in a sentence</Label><Input id={`s-${o?.id ?? 'new'}`} name="summary" defaultValue={o?.summary ?? ''} maxLength={600} /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor={`k-${o?.id ?? 'new'}`}>Skills it builds, separated by commas</Label><Input id={`k-${o?.id ?? 'new'}`} name="skills" defaultValue={o?.skills.join(', ') ?? ''} placeholder="Sales and negotiation, People management" /></div>
        <div className="space-y-1"><Label htmlFor={`h-${o?.id ?? 'new'}`}>Hours</Label><Input id={`h-${o?.id ?? 'new'}`} name="hours" inputMode="numeric" defaultValue={o?.hours ?? ''} /></div>
        <div className="space-y-1"><Label htmlFor={`c-${o?.id ?? 'new'}`}>Price in dollars (blank for free)</Label><Input id={`c-${o?.id ?? 'new'}`} name="price" inputMode="decimal" defaultValue={o ? (o.priceCents / 100 || '') : ''} /></div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="wioaEligible" defaultChecked={o?.wioaEligible} className="size-4" />On the eligible training list (can be paid by the workforce board)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="ncCustom" defaultChecked={o?.ncCustom} className="size-4" />Built for this region by NextChapter (only for training offered by your region)</label>
      </div>
      <AudiencePicker industries={o?.industries} functions={o?.functions} levels={o?.levels} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{o ? 'Save changes' : 'Add to the catalog'}</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function ArchiveOfferingButton({ slug, id, title }: { slug: string; id: string; title: string }) {
  const [state, action] = useActionState<EducationResult, FormData>(archiveOffering.bind(null, slug, id), undefined)
  return (
    <form action={action} className="flex items-center gap-2">
      <SubmitButton size="sm" variant="outline" pendingLabel="Removing…" aria-label={`Remove ${title} from the catalog`}>Remove from the catalog</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export function ImportProgramButton({ slug, programId, name }: { slug: string; programId: string; name: string }) {
  const [state, action] = useActionState<EducationResult, FormData>(importCollegeProgram.bind(null, slug, programId), undefined)
  return (
    <form action={action} className="flex items-center gap-2">
      <SubmitButton size="sm" pendingLabel="Adding…" aria-label={`Add ${name} to the catalog`}>Add to the catalog</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export function AssignForm({ slug, offering }: { slug: string; offering: OfferingView }) {
  const [state, action] = useActionState<EducationResult, FormData>(setAssignment.bind(null, slug, offering.id), undefined)
  return (
    <form action={action} className="space-y-3">
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Show it in Learn to the people it fits</legend>
        <div className="flex flex-wrap gap-2">
          {[['ASSIGNED', 'Assign it'], ['LISTED', 'Only list it']].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="assignment" value={v} defaultChecked={offering.assignment === v} className="size-4" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <AudiencePicker industries={offering.industries} functions={offering.functions} levels={offering.levels} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save assignment</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}
