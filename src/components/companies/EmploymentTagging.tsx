'use client'

import { useActionState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  confirmWorkHistoryTag,
  tagEmployerManual,
  optInCurrentEmployerInsider,
  type ActionFormState,
} from '@/app/dashboard/companies/[slug]/actions'
import { useState } from 'react'

// Prompt 4.1's real contribution gate — "Add where you've worked to unlock
// this. We'll pull it from your resume — just confirm." One click per
// resume-derived WorkHistoryEntry row, plus a manual fallback for anyone
// with no parsed history yet (or an employer not on their resume).

export function ConfirmWorkHistoryButton({
  workHistoryEntryId,
  companyPageId,
}: {
  workHistoryEntryId: string
  companyPageId: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      className={pending ? 'cursor-progress' : ''}
      onClick={() => startTransition(() => confirmWorkHistoryTag(workHistoryEntryId, companyPageId))}
    >
      {pending ? 'Confirming…' : 'Confirm'}
    </Button>
  )
}

export function ManualTagForm({ companyPageId, defaultCompanyName }: { companyPageId: string; defaultCompanyName?: string }) {
  const boundAction = tagEmployerManual.bind(null, companyPageId)
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(boundAction, undefined)
  const [isCurrent, setIsCurrent] = useState(false)

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" defaultValue={defaultCompanyName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Your title</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        {!isCurrent && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" name="endDate" type="date" />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isCurrent" checked={isCurrent} onCheckedChange={(v) => setIsCurrent(v === true)} />
        This is my current employer
      </label>
      <SubmitButton pendingLabel="Adding…" size="sm" className={pending ? 'w-fit cursor-progress' : 'w-fit'}>
        Add employer
      </SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

// The explicit, separate opt-in for a candidate's CURRENT employer (Prompt
// 4.2) — never defaulted on, always shown with this warning first.
export function CurrentEmployerInsiderOptIn({ companyId, companyPageId }: { companyId: string; companyPageId: string }) {
  const [pending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return <p className="text-sm text-muted-foreground">You&apos;re listed as a current-employee insider here.</p>
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <p>
        You can optionally appear as a current-employee insider for this company. Other members may ask you
        questions about it — including things you may not want to answer about your own employer. You choose
        what to share.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className={`w-fit ${pending ? 'cursor-progress' : ''}`}
        onClick={() =>
          startTransition(async () => {
            await optInCurrentEmployerInsider(companyId, companyPageId)
            setDismissed(true)
          })
        }
      >
        {pending ? 'Saving…' : 'Yes, list me as an insider here'}
      </Button>
    </div>
  )
}
