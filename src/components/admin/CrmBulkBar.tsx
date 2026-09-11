'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkUpdatePeople, bulkDeletePeople } from '@/app/support/admin/(portal)/crm/actions'
import { PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS, WARMTHS, WARMTH_LABELS } from '@/lib/crm/labels'

// Wraps the results table so the row checkboxes and this bar share one form.
// Bulk edit is what makes a list of thousands workable: twenty rows, one
// action, one entry in each person's history.
export function CrmBulkBar({ children, count }: { children: React.ReactNode; count: number }) {
  const [selected, setSelected] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const recount = (form: HTMLFormElement) =>
    setSelected(form.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)

  return (
    <form
      onChange={(e) => { recount(e.currentTarget); setConfirmingDelete(false); setResult(null) }}
    >
      {children}

      <div className="sticky bottom-0 mt-3 space-y-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-sm text-muted-foreground">
            {selected > 0 ? `${selected} of ${count} selected` : 'Tick rows to edit several at once'}
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

          {/* Multi-select: a person is routinely more than one thing, and
              applying types one pass at a time is how the field stays empty. */}
          <label className="text-xs">
            <span className="mb-1 block font-medium">
              Add contact types <span className="font-normal text-muted-foreground">pick several</span>
            </span>
            <select
              name="bulkRole" multiple size={3}
              className="min-w-44 rounded border border-input bg-transparent px-2 py-1 text-xs"
            >
              {PERSON_ROLES.map((r) => <option key={r} value={r}>{PERSON_ROLE_LABELS[r]}</option>)}
            </select>
          </label>

          <SubmitButton
            formAction={bulkUpdatePeople}
            variant="outline"
            disabled={selected === 0}
            pendingLabel="Applying…"
          >
            Apply to selected
          </SubmitButton>

          {selected === 0 && <span className="text-xs text-muted-foreground">Tick at least one row to enable this.</span>}
        </div>

        {selected > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            {/* Destructive, so it takes a second explicit step and is never
                the default focus, per design-principles.md. */}
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive"
              >
                Remove {selected} selected
              </button>
            ) : (
              <>
                <span className="text-xs font-medium text-destructive">
                  Delete {selected} {selected === 1 ? 'person' : 'people'} permanently? Their history goes too.
                </span>
                <SubmitButton
                  formAction={async (fd: FormData) => {
                    const r = await bulkDeletePeople(fd)
                    setResult(
                      r.skipped > 0
                        ? `Deleted ${r.deleted}. Kept ${r.skipped} already converted to a coach, recruiter or candidate.`
                        : `Deleted ${r.deleted}.`
                    )
                    setConfirmingDelete(false)
                  }}
                  size="sm"
                  pendingLabel="Deleting…"
                >
                  Yes, delete
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
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
