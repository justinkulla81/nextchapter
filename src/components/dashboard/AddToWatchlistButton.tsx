'use client'

import { useState, useTransition } from 'react'
import { addWatchlistCompanyByName } from '@/app/dashboard/company-tracker/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Inline "Track this company" affordance for job cards on Job Fit and the
// NC Job Board (Prompt 77) — same underlying watchlist as the dedicated
// Company Tracker page, just reachable without leaving the job listing.
export function AddToWatchlistButton({ companyName }: { companyName: string }) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'added' | 'error'>('idle')

  if (state === 'added') {
    return <span className="text-xs font-medium text-success">Tracking {companyName}</span>
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(isPending && 'cursor-progress')}
        onClick={() =>
          startTransition(async () => {
            const result = await addWatchlistCompanyByName(companyName)
            setState(result.error ? 'error' : 'added')
          })
        }
      >
        Track this company
      </Button>
      {state === 'error' && <span className="text-xs text-muted-foreground">Already tracking {companyName}</span>}
    </div>
  )
}
