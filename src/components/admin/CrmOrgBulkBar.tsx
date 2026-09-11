'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkUpdateOrganizations, bulkDeleteOrganizations } from '@/app/support/admin/(portal)/crm/actions'
import { ORG_TYPES, ORG_TYPE_LABELS } from '@/lib/crm/labels'
import { GOALS, GOAL_LABELS } from '@/lib/crm/goals'

export function CrmOrgBulkBar({ children, count }: { children: React.ReactNode; count: number }) {
  const [selected, setSelected] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  return (
    <form
      onChange={(e) => {
        setSelected(e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)
        setConfirming(false); setResult(null)
      }}
    >
      {children}

      <div className="sticky bottom-0 mt-3 space-y-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-sm text-muted-foreground">
            {selected > 0 ? `${selected} of ${count} selected` : 'Tick rows to edit several at once'}
          </p>

          <label className="text-xs">
            <span className="mb-1 block font-medium">Add types <span className="font-normal text-muted-foreground">pick several</span></span>
            <select name="bulkOrgType" multiple size={3} className="min-w-44 rounded border border-input bg-transparent px-2 py-1 text-xs">
              {ORG_TYPES.map((t) => <option key={t} value={t}>{ORG_TYPE_LABELS[t]}</option>)}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium">Add goals</span>
            <select name="bulkGoal" multiple size={3} className="min-w-44 rounded border border-input bg-transparent px-2 py-1 text-xs">
              {GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium">Set state</span>
            <input name="bulkState" placeholder="NY" maxLength={9}
              className="h-8 w-20 rounded border border-input bg-transparent px-2 text-xs" />
          </label>

          <SubmitButton formAction={bulkUpdateOrganizations} variant="outline" disabled={selected === 0} pendingLabel="Applying…">
            Apply to selected
          </SubmitButton>
          {selected === 0 && <span className="text-xs text-muted-foreground">Tick at least one row to enable this.</span>}
        </div>

        {selected > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)}
                className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
                Remove {selected} selected
              </button>
            ) : (
              <>
                <span className="text-xs font-medium text-destructive">
                  Delete {selected}? Only empty organizations — any holding people or deals are kept.
                </span>
                <SubmitButton
                  formAction={async (fd: FormData) => {
                    const r = await bulkDeleteOrganizations(fd)
                    setResult(r.skipped > 0
                      ? `Deleted ${r.deleted}. Kept ${r.skipped} that still hold people, deals or a production link.`
                      : `Deleted ${r.deleted}.`)
                    setConfirming(false)
                  }}
                  size="sm" pendingLabel="Deleting…"
                >
                  Yes, delete
                </SubmitButton>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                  Cancel
                </button>
              </>
            )}
            {result && <span role="status" className="text-xs text-muted-foreground">{result}</span>}
          </div>
        )}
      </div>
    </form>
  )
}
