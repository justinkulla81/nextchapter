'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkCompletion } from '@/app/support/admin/(portal)/crm/actions'

export function CrmCompletionBulkBar({ children, count }: { children: React.ReactNode; count: number }) {
  const router = useRouter()
  const [selected, setSelected] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const run = (mode: string) => async (fd: FormData) => {
    fd.set('mode', mode)
    await bulkCompletion(fd)
    setConfirming(false)
    // The rows just acted on drop out of the query entirely, so nothing
    // stays checked — reset the count to match rather than leaving it
    // showing a stale "N selected" against a form that's now empty. The bar
    // itself disappears the instant that happens (below) — a confirmation
    // that outlives the selection it describes reads as stuck UI, not
    // feedback.
    setSelected(0)
    // bulkCompletion is called through this client-defined `run` wrapper,
    // not passed directly as a bound server action reference — Next only
    // auto-refreshes the page for the latter, so without this the rows just
    // acted on (accepted, approved, removed) keep showing until a real
    // navigation happens.
    router.refresh()
  }

  return (
    <form
      onChange={(e) => {
        setSelected(e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)
        setConfirming(false)
      }}
    >
      {children}

      {selected > 0 && (
        <div className="sticky bottom-0 mt-3 space-y-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{selected} of {count} selected</p>
            <SubmitButton formAction={run('accept')} size="sm" pendingLabel="Applying…">
              Use suggestions
            </SubmitButton>
            <SubmitButton formAction={run('approve')} variant="outline" size="sm" pendingLabel="Approving…">
              Approve as-is
            </SubmitButton>

            {!confirming && (
              <button type="button" onClick={() => setConfirming(true)}
                className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
                Remove {selected}
              </button>
            )}
            {confirming && (
              <>
                <span className="text-xs font-medium text-destructive">
                  Remove {selected} from the CRM? They&apos;ll stop showing up anywhere.
                </span>
                <SubmitButton formAction={run('delete')} size="sm" pendingLabel="Removing…">Yes, remove</SubmitButton>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </form>
  )
}
