'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkUpdatePeople } from '@/app/support/admin/(portal)/crm/actions'
import { PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS, WARMTHS, WARMTH_LABELS } from '@/lib/crm/labels'

// Wraps the results table so the row checkboxes and this bar share one form.
// Bulk edit is what makes the completion queue clearable rather than
// aspirational: twenty rows, one action, one entry in each person's history.
export function CrmBulkBar({ children, count }: { children: React.ReactNode; count: number }) {
  const [selected, setSelected] = useState(0)

  return (
    <form
      action={bulkUpdatePeople}
      onChange={(e) => {
        const form = e.currentTarget
        setSelected(form.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)
      }}
    >
      {children}

      <div className="sticky bottom-0 mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {selected > 0
            ? `${selected} of ${count} selected`
            : 'Tick rows to edit several at once'}
        </p>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Quality</span>
          <select name="bulkQuality" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave as is</option>
            {QUALITIES.map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Warmth</span>
          <select name="bulkWarmth" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave as is</option>
            {WARMTHS.map((w) => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-medium">Add contact type</span>
          <select name="bulkRole" defaultValue="" className="h-8 rounded border border-input bg-transparent px-2 text-xs">
            <option value="">Leave as is</option>
            {PERSON_ROLES.map((r) => <option key={r} value={r}>{PERSON_ROLE_LABELS[r]}</option>)}
          </select>
        </label>

        <SubmitButton
          variant="outline"
          disabled={selected === 0}
          pendingLabel="Applying…"
          title={selected === 0 ? 'Tick at least one row first' : undefined}
        >
          Apply to selected
        </SubmitButton>
        {selected === 0 && (
          <span className="text-xs text-muted-foreground">Tick at least one row to enable this.</span>
        )}
      </div>
    </form>
  )
}
