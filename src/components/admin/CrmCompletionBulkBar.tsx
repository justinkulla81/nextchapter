'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkCompletion } from '@/app/support/admin/(portal)/crm/actions'

export function CrmCompletionBulkBar({ children, count }: { children: React.ReactNode; count: number }) {
  const [selected, setSelected] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const run = (mode: string) => async (fd: FormData) => {
    fd.set('mode', mode)
    setResult((await bulkCompletion(fd)).message)
    setConfirming(false)
  }

  return (
    <form
      onChange={(e) => {
        setSelected(e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)
        setConfirming(false); setResult(null)
      }}
    >
      {children}

      <div className="sticky bottom-0 mt-3 space-y-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {selected > 0 ? `${selected} of ${count} selected` : 'Tick rows to clear several at once'}
          </p>
          <SubmitButton formAction={run('accept')} disabled={selected === 0} size="sm" pendingLabel="Applying…">
            Use suggestions
          </SubmitButton>
          <SubmitButton formAction={run('dismiss')} disabled={selected === 0} size="sm" variant="outline" pendingLabel="Marking…">
            Mark fine
          </SubmitButton>

          {selected > 0 && !confirming && (
            <button type="button" onClick={() => setConfirming(true)}
              className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
              Remove {selected}
            </button>
          )}
          {confirming && (
            <>
              <span className="text-xs font-medium text-destructive">Delete {selected} permanently?</span>
              <SubmitButton formAction={run('delete')} size="sm" pendingLabel="Removing…">Yes, delete</SubmitButton>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                Cancel
              </button>
            </>
          )}
          {selected === 0 && <span className="text-xs text-muted-foreground">Tick at least one row to enable these.</span>}
        </div>
        {result && <p role="status" className="text-xs text-muted-foreground">{result}</p>}
      </div>
    </form>
  )
}
