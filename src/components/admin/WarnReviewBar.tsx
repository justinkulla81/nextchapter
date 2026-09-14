'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { promoteNotices, dismissNotices, runWarnSyncNow } from '@/app/support/admin/(portal)/crm/warn/actions'

export function WarnReviewBar({ children, count }: { children: React.ReactNode; count: number }) {
  const [selected, setSelected] = useState(0)
  const [result, setResult] = useState<string | null>(null)

  const run = (fn: (fd: FormData) => Promise<{ message: string }>) => async (fd: FormData) => {
    setResult((await fn(fd)).message)
  }

  return (
    <form
      onChange={(e) => {
        setSelected(e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="selected"]:checked').length)
        setResult(null)
      }}
    >
      {children}

      <div className="sticky bottom-0 mt-3 space-y-2 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {selected > 0 ? `${selected} of ${count} selected` : 'Tick the ones worth calling'}
          </p>
          <SubmitButton formAction={run(promoteNotices)} disabled={selected === 0} size="sm" pendingLabel="Creating…">
            Create leads
          </SubmitButton>
          <label className="text-xs">
            <input name="reason" placeholder="Why not (optional)"
              className="h-8 w-44 rounded border border-input bg-transparent px-2 text-xs" />
          </label>
          <SubmitButton formAction={run(dismissNotices)} disabled={selected === 0} size="sm" variant="outline" pendingLabel="Dismissing…">
            Not our market
          </SubmitButton>
          {selected === 0 && <span className="text-xs text-muted-foreground">Tick at least one to enable these.</span>}
        </div>
        {result && <p role="status" className="text-xs text-muted-foreground">{result}</p>}
      </div>
    </form>
  )
}

export function WarnSyncNowButton() {
  const [result, setResult] = useState<string | null>(null)
  return (
    <form action={async () => setResult((await runWarnSyncNow()).message)}>
      <SubmitButton size="sm" variant="outline" pendingLabel="Fetching…">Sync now</SubmitButton>
      {result && <p role="status" className="mt-1 text-xs text-muted-foreground">{result}</p>}
    </form>
  )
}
