'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkUpdateOpportunities } from '@/app/support/admin/(portal)/crm/actions'
import { QUALITIES, QUALITY_LABELS, ELIGIBILITY_LABELS } from '@/lib/crm/labels'
import type { CrmEligibility } from '@prisma/client'

/**
 * Bulk edit for leads.
 *
 * Stage is chosen by KEY, not by id: stage ids belong to one pipeline, and a
 * selection routinely spans several. Anything whose pipeline has no stage with
 * that key is skipped and reported rather than quietly left alone.
 */
export function CrmLeadBulkBar({
  children, count, stageKeys,
}: {
  children: React.ReactNode
  count: number
  stageKeys: { key: string; label: string }[]
}) {
  const [selected, setSelected] = useState(0)
  const [result, setResult] = useState<string | null>(null)

  return (
    <form
      onChange={(e) => {
        setSelected(e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)
        setResult(null)
      }}
    >
      {children}

      <div className="sticky bottom-0 mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {selected > 0 ? `${selected} of ${count} selected` : 'Tick rows to edit several at once'}
        </p>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Move to stage</span>
          <select name="bulkStageKey" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave as is</option>
            {stageKeys.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Grade</span>
          <select name="bulkQuality" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave as is</option>
            {QUALITIES.map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Eligibility</span>
          <select name="bulkEligibility" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave as is</option>
            {(Object.keys(ELIGIBILITY_LABELS) as CrmEligibility[]).map((e) => (
              <option key={e} value={e}>{ELIGIBILITY_LABELS[e]}</option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Close as</span>
          <select name="bulkClose" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave open</option>
            <option value="LOST">Lost</option>
            <option value="DORMANT">Dormant</option>
          </select>
        </label>

        <SubmitButton
          formAction={async (fd: FormData) => {
            const r = await bulkUpdateOpportunities(fd)
            setResult(r.skipped > 0
              ? `Updated ${r.updated}. Skipped ${r.skipped} whose pipeline has no stage by that name.`
              : `Updated ${r.updated}.`)
          }}
          variant="outline" disabled={selected === 0} pendingLabel="Applying…"
        >
          Apply to selected
        </SubmitButton>
        {selected === 0 && <span className="text-xs text-muted-foreground">Tick at least one row to enable this.</span>}
        {result && <span role="status" className="text-xs text-muted-foreground">{result}</span>}
      </div>
    </form>
  )
}
