'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { lookupCompliancePackAction } from '@/app/employer/(app)/compliance/actions'
import { formatCompliancePackText } from '@/lib/employer/format-compliance-pack'

function fmt(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function CompliancePackLookup() {
  const [state, formAction] = useActionState(lookupCompliancePackAction, undefined)

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="email">Their email</Label>
          <Input id="email" name="email" type="email" required placeholder="jane@example.com" />
          <p className="text-xs text-muted-foreground">
            Exact match only — this isn&apos;t a browsable list. Every lookup is logged with your reason.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for this lookup</Label>
          <Textarea id="reason" name="reason" required placeholder="e.g. Separation agreement audit, Doe v. Acme" />
        </div>
        <SubmitButton pendingLabel="Looking up…">Generate compliance record</SubmitButton>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </form>

      {state?.pack && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{state.pack.invitedName ?? state.pack.invitedEmail}</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadText(
                  `nextchapter-compliance-${state.pack!.invitedEmail.replace(/[^a-z0-9]/gi, '-')}.txt`,
                  formatCompliancePackText(state.pack!)
                )
              }
            >
              Download as text file
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{state.pack.invitedEmail}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tier / cohort</dt>
              <dd>
                {state.pack.tier} {state.pack.cohortLabel ? `· ${state.pack.cohortLabel}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contract term</dt>
              <dd>
                {fmt(state.pack.termStartAt)} – {fmt(state.pack.termEndAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{state.pack.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Enrolled</dt>
              <dd>{fmt(state.pack.enrolledAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Activated</dt>
              <dd>{fmt(state.pack.activatedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Placed</dt>
              <dd>{fmt(state.pack.placedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PO / invoice reference</dt>
              <dd>
                {state.pack.poReference ?? '—'} / {state.pack.invoiceReference ?? '—'}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            This record contains no job-search activity, grade, or engagement detail — those are never
            shared outside the individual and their coach.
          </p>
        </div>
      )}
    </div>
  )
}
