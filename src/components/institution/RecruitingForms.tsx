'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  RECRUITING_DATE_KINDS, RECRUITING_DATE_LABELS, EARLY_CAREER_KINDS, EARLY_CAREER_LABELS,
} from '@/lib/higher-ed/recruiting-rules'

type State = { error?: string; ok?: boolean } | undefined
type Action = (prev: State, formData: FormData) => Promise<State>

/**
 * Wraps a form action so that what staff typed survives a failed save: React resets
 * an uncontrolled form after every action, which would wipe the fields on an error.
 * The values are kept and cleared only once the save goes through.
 */
function useKeptValues(action: Action) {
  const [kept, setKept] = useState<Record<string, string>>({})
  const [state, formAction] = useActionState<State, FormData>(async (prev, fd) => {
    setKept(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>)
    const result = await action(prev, fd)
    if (result?.ok) setKept({})
    return result
  }, undefined)
  return { kept, state, formAction, v: (k: string) => kept[k] ?? '' }
}

function Field({ id, label, children, className = '' }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-44 flex-1 space-y-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

/** Adjacent choice buttons for two to four options (a native radio group, keyboard-accessible). */
function ChoiceButtons({ name, legend, options, defaultValue }: { name: string; legend: string; options: { value: string; label: string }[]; defaultValue: string }) {
  return (
    <fieldset className="w-full space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm has-[:checked]:border-foreground has-[:checked]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} required className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function CoreRecruiterForm({ saveAction, core, contactName, contactEmail }: {
  saveAction: Action
  core: boolean
  contactName: string | null
  contactEmail: string | null
}) {
  const [state, formAction] = useActionState(saveAction, undefined)
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <Field id="contactName" label="Recruiter name">
        <Input id="contactName" name="contactName" defaultValue={contactName ?? ''} />
      </Field>
      <Field id="contactEmail" label="Recruiter email">
        <Input id="contactEmail" name="contactEmail" type="email" defaultValue={contactEmail ?? ''} />
      </Field>
      {core ? (
        <>
          <SubmitButton name="core" value="yes" size="sm" pendingLabel="Saving…" savedLabel="Saved">Save recruiter details</SubmitButton>
          <SubmitButton name="core" value="no" size="sm" variant="outline" pendingLabel="Removing…" savedLabel="Removed">Remove core recruiter flag</SubmitButton>
        </>
      ) : (
        <SubmitButton name="core" value="yes" size="sm" pendingLabel="Saving…" savedLabel="Marked">Mark as core recruiter</SubmitButton>
      )}
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

export function RecruitingDateForm({ addAction }: { addAction: Action }) {
  const { state, formAction, v } = useKeptValues(addAction)
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <Field id="rd-company" label="Company"><Input id="rd-company" name="companyName" required defaultValue={v('companyName')} /></Field>
      <Field id="rd-title" label="Title"><Input id="rd-title" name="title" required placeholder="Fall career fair" defaultValue={v('title')} /></Field>
      <Field id="rd-kind" label="Kind">
        <select id="rd-kind" name="kind" required defaultValue={v('kind') || 'CAREER_FAIR'} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          {RECRUITING_DATE_KINDS.map((k) => <option key={k} value={k}>{RECRUITING_DATE_LABELS[k]}</option>)}
        </select>
      </Field>
      <Field id="rd-when" label="Date and time"><Input id="rd-when" name="startsAt" type="datetime-local" required defaultValue={v('startsAt')} /></Field>
      <Field id="rd-where" label="Where"><Input id="rd-where" name="location" defaultValue={v('location')} /></Field>
      <Field id="rd-url" label="Link"><Input id="rd-url" name="url" type="url" placeholder="https://" defaultValue={v('url')} /></Field>
      <Field id="rd-note" label="Note (private to your team)"><Input id="rd-note" name="note" defaultValue={v('note')} /></Field>
      <SubmitButton pendingLabel="Adding…" savedLabel="Added">Add recruiting date</SubmitButton>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

export function EarlyCareerRoleForm({ addAction }: { addAction: Action }) {
  const { state, formAction, v } = useKeptValues(addAction)
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <Field id="ec-company" label="Company"><Input id="ec-company" name="companyName" required defaultValue={v('companyName')} /></Field>
      <Field id="ec-title" label="Role title"><Input id="ec-title" name="title" required defaultValue={v('title')} /></Field>
      <ChoiceButtons
        name="kind" legend="Type" defaultValue={v('kind') || 'INTERNSHIP'}
        options={EARLY_CAREER_KINDS.map((k) => ({ value: k, label: EARLY_CAREER_LABELS[k] }))}
      />
      <Field id="ec-where" label="Location"><Input id="ec-where" name="location" defaultValue={v('location')} /></Field>
      <Field id="ec-years" label="Graduating classes"><Input id="ec-years" name="classYears" placeholder="2027, 2028" defaultValue={v('classYears')} /></Field>
      <Field id="ec-deadline" label="Apply by"><Input id="ec-deadline" name="deadline" type="date" defaultValue={v('deadline')} /></Field>
      <Field id="ec-url" label="Apply link"><Input id="ec-url" name="applyUrl" type="url" placeholder="https://" defaultValue={v('applyUrl')} /></Field>
      <Field id="ec-note" label="Note (private to your team)"><Input id="ec-note" name="note" defaultValue={v('note')} /></Field>
      <SubmitButton pendingLabel="Adding…" savedLabel="Added">Add role</SubmitButton>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
