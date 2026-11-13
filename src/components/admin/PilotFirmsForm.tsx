'use client'

import { useActionState } from 'react'
import { createPilotFirms } from '@/app/support/admin/(portal)/recruiter-settings/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/ui/copy-button'

// Admin: paste up to 100 firms, get a live, pre-verified firm and a registration link for each, as a CSV. Nothing is emailed.
export function PilotFirmsForm() {
  const [state, action, pending] = useActionState(createPilotFirms, undefined)
  return (
    <form action={action} className={pending ? 'space-y-3 cursor-progress' : 'space-y-3'}>
      <div className="space-y-2">
        <Label htmlFor="pf-lines">Firms, one per line: name, website, contact email</Label>
        <Textarea id="pf-lines" name="lines" rows={6} placeholder={'Hartley Search, hartleysearch.com, pat@hartleysearch.com'} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Each firm goes live now. Its link only works for someone at the contact&apos;s company. Arm A leads with the free branded page, arm B with the free CRM, split by a fixed rule on the email.
        </p>
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.created !== undefined && <p className="text-sm">{state.created} {state.created === 1 ? 'firm' : 'firms'} created.</p>}
      {state?.skipped && state.skipped.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {state.skipped.map((s, i) => (
            <li key={i}>{s.name}: {s.reason}</li>
          ))}
        </ul>
      )}
      {state?.csv && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Links (CSV)</p>
            <CopyButton text={state.csv} />
          </div>
          <Textarea readOnly value={state.csv} rows={6} className="font-mono text-xs" aria-label="Registration links as CSV" />
        </div>
      )}
      <SubmitButton pendingLabel="Creating firms…">Create firms and links</SubmitButton>
    </form>
  )
}
