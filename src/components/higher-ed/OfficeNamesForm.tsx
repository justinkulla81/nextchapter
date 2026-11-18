'use client'

// Admin › Branding › Office names. Each college calls its offices something different ("University Advancement",
// "Career & Professional Development"). A blank field keeps NextChapter's name.

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

type State = { error?: string; ok?: boolean; message?: string } | undefined

export function OfficeNamesForm({ saveAction, offices, max }: { saveAction: (prev: State, formData: FormData) => Promise<State>; offices: { key: string; standard: string; current: string | null }[]; max: number }) {
  const [state, action] = useActionState(saveAction, undefined)
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Office names</h2>
        <p className="text-sm text-muted-foreground">What your college calls each office. Staff see these names in the menu and on each page. Leave a field blank to keep the name shown.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {offices.map((o) => (
          <div key={o.key} className="space-y-1.5">
            <Label htmlFor={`office-${o.key}`}>{o.standard}</Label>
            <Input id={`office-${o.key}`} name={o.key} defaultValue={o.current ?? ''} maxLength={max} placeholder={o.standard} />
          </div>
        ))}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
      <SubmitButton pendingLabel="Saving…">Save office names</SubmitButton>
    </form>
  )
}
