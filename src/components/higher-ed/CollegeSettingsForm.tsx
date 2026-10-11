'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

type State = { error?: string; ok?: boolean; message?: string } | undefined
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function CollegeSettingsForm({
  action,
  defaults,
  canEdit,
}: {
  action: (prev: State, formData: FormData) => Promise<State>
  defaults: { graceDays: number; fiscalYearStartMonth: number; givingUrl: string | null }
  canEdit: boolean
}) {
  const [state, formAction] = useActionState(action, undefined)
  const [grace, setGrace] = useState(String(defaults.graceDays))
  const [month, setMonth] = useState(String(defaults.fiscalYearStartMonth))
  const [giving, setGiving] = useState(defaults.givingUrl ?? '')
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="set-grace">Quiet period after a new job (days)</Label>
        <Input id="set-grace" name="graceDays" type="number" min={0} max={365} value={grace} onChange={(e) => setGrace(e.target.value)} disabled={!canEdit} />
        <p className="text-xs text-muted-foreground">No fundraising asks until this passes.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="set-fy">Fiscal year starts</Label>
        <select id="set-fy" name="fiscalYearStartMonth" value={month} onChange={(e) => setMonth(e.target.value)} disabled={!canEdit} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="set-giving">Giving page</Label>
        <Input id="set-giving" name="givingUrl" type="url" placeholder="https://" value={giving} onChange={(e) => setGiving(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        {canEdit ? <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton> : <p className="text-xs text-muted-foreground">Only an institution admin can change these.</p>}
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </form>
  )
}
