'use client'

import { useEffect, useRef, useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkUpdatePeople, bulkDeletePeople } from '@/app/support/admin/(portal)/crm/actions'
import { QUALITIES, QUALITY_LABELS, WARMTHS, WARMTH_LABELS } from '@/lib/crm/labels'
import { CrmRolePicker } from './CrmRolePicker'

// Wraps the results table so the row checkboxes and this bar share one form.
// Bulk edit is what makes a list of thousands workable: twenty rows, one
// action, one entry in each person's history.
export function CrmBulkBar({ children, count }: { children: React.ReactNode; count: number }) {
  const [selected, setSelected] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const formRef = useRef<HTMLFormElement>(null)

  const recount = (form: HTMLFormElement) =>
    setSelected(form.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)

  // The count lives in state but the truth is the checkboxes. When rows
  // change under it — a removal, a refresh — re-read them, or the bar goes on
  // claiming "2 of 1 selected" about people who no longer exist.
  useEffect(() => {
    if (formRef.current) recount(formRef.current)
  }, [count, children])

  return (
    <form
      ref={formRef}
      onChange={(e) => { recount(e.currentTarget); setConfirmingDelete(false); setResult(null) }}
    >
      {children}

      {selected === 0 && result && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">{result}</p>
      )}

      {/* Only once something is ticked. It used to sit there permanently in
          a disabled state explaining how to enable itself, which cost a strip
          of every screen to say nothing — the row checkboxes are the
          affordance, and this is the response to using them. */}
      {selected > 0 && (
        <div className="sticky bottom-0 mt-3 space-y-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-sm font-medium">{selected} of {count} selected</p>

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

            {/* A person is routinely more than one thing, and applying types
                one pass at a time is how the field stays empty. */}
            <div className="text-xs">
              <span className="mb-1 block font-medium">
                Add contact types <span className="font-normal text-muted-foreground">pick several</span>
              </span>
              <CrmRolePicker name="bulkRole" label="Add contact types" placeholder="None" />
            </div>

            <SubmitButton
              formAction={bulkUpdatePeople}
              variant="outline"
              pendingLabel="Applying…"
            >
              Apply to selected
            </SubmitButton>
          </div>

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
                    Remove {selected} {selected === 1 ? 'person' : 'people'}? They&apos;ll stop showing up anywhere,
                    and re-uploading old data won&apos;t bring them back.
                  </span>
                  <SubmitButton
                    formAction={async (fd: FormData) => {
                      const r = await bulkDeletePeople(fd)
                      setResult(
                        r.skipped > 0
                          ? `Removed ${r.deleted}. Kept ${r.skipped} already converted to a coach, recruiter or candidate.`
                          : `Removed ${r.deleted}.`
                      )
                      setConfirmingDelete(false)
                    }}
                    size="sm"
                    pendingLabel="Removing…"
                  >
                    Yes, remove
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
        </div>
      )}
    </form>
  )
}
