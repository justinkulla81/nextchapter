'use client'

import { useActionState, useState } from 'react'
import { requestReference } from '@/app/dashboard/references/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_TYPE_HELP } from '@/lib/constants/references'
import { cn } from '@/lib/utils'
import { ChoiceField } from '@/components/candidate/ChoiceField'

export function ReferenceRequestForm({
  initialName,
  initialEmail,
  workHistoryEntries = [],
  confidentialSearchMode = false,
}: {
  initialName?: string
  initialEmail?: string
  // Lets the candidate tie this reference to one of their own jobs, so the
  // ref token page can ask the referee to verify that job's title/company/
  // resume bullet instead of nothing at all. Optional — omit entirely for
  // references that don't map to a single role (e.g. a peer who knew the
  // candidate across several).
  workHistoryEntries?: { id: string; companyName: string; roleTitle: string }[]
  // PART TWO §8 — when true, entering a company that matches the
  // candidate's own current employer (checked server-side in
  // requestReference) pauses submission on an explicit second confirmation
  // instead of sending immediately. Open-mode candidates never see this.
  confidentialSearchMode?: boolean
} = {}) {
  const [state, formAction, pending] = useActionState(requestReference, undefined)
  // Server-checked, client-acknowledged — mirrors ConfidentialModeToggle's
  // "confirmed" gate. Only ever set once the server has actually flagged a
  // match; resubmitting sends currentEmployerConfirmed=true back through.
  const [riskAcknowledged, setRiskAcknowledged] = useState(false)

  const field = 'h-11 text-base'
  const label = 'text-base font-semibold text-ink'
  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="refereeName" className={label}>Their name</Label>
          <Input id="refereeName" name="refereeName" defaultValue={initialName} required className={field} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refereeEmail" className={label}>Their email</Label>
          <Input id="refereeEmail" name="refereeEmail" type="email" defaultValue={initialEmail} required className={field} />
        </div>
      </div>
      <ChoiceField
        name="relationshipType"
        label="How did you work together?"
        why={RELATIONSHIP_TYPE_HELP}
        options={Object.entries(RELATIONSHIP_TYPE_LABELS).map(([value, v]) => ({ value, label: v }))}
        defaultValue="DIRECT_MANAGER"
        required
      />
      <details className="group space-y-5">
        <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
          Add more detail (optional)
        </summary>
        <div className="grid gap-5 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="refereeTitle" className={label}>Their title</Label>
            <Input id="refereeTitle" name="refereeTitle" className={field} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refereeCompany" className={label}>Their company</Label>
            <Input id="refereeCompany" name="refereeCompany" onChange={() => setRiskAcknowledged(false)} className={field} />
            {confidentialSearchMode && <p className="text-sm text-muted-foreground">Since you are searching confidentially, we check whether this is your current employer before sending.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="yearsWorkedTogether" className={label}>Years worked together</Label>
            <Input id="yearsWorkedTogether" name="yearsWorkedTogether" type="number" min={0} max={40} className={field} />
          </div>
          {workHistoryEntries.length > 0 && (
            <div className="sm:col-span-2">
              <ChoiceField
                name="workHistoryEntryId"
                label="Which job was this for?"
                why="Lets them confirm your title, company and one résumé highlight from that role."
                placeholder="Not tied to one specific job"
                options={workHistoryEntries.map((e) => ({ value: e.id, label: `${e.roleTitle} at ${e.companyName}` }))}
                defaultValue=""
              />
            </div>
          )}
        </div>
      </details>

      {state?.error && (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      )}

      {state?.needsCurrentEmployerConfirmation && (
        <div className="space-y-3 rounded-2xl bg-muted/60 p-5">
          <p className="text-base font-semibold text-ink">
            This looks like your current employer
            {state.matchedEmployerName ? ` (${state.matchedEmployerName})` : ''}.
          </p>
          <p className="text-base text-ink">
            Since you are searching confidentially, a reference from someone at your current employer carries real risk: they could mention it to a colleague or manager there. Former colleagues, managers, board members or clients are the safer choice.
          </p>
          <label className="flex items-start gap-2 text-base text-ink">
            <input type="checkbox" name="currentEmployerConfirmed" value="true" checked={riskAcknowledged} onChange={(e) => setRiskAcknowledged(e.target.checked)} required className="mt-1.5 size-4" />
            I understand the risk and want to send this request anyway
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || (state?.needsCurrentEmployerConfirmation && !riskAcknowledged)}
          className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? 'Sending…' : state?.needsCurrentEmployerConfirmation ? 'Send anyway' : 'Send request'}
        </button>
        {state?.needsCurrentEmployerConfirmation && !riskAcknowledged && <span className="text-sm text-muted-foreground">Tick the box above to send this request.</span>}
      </div>
    </form>
  )
}
