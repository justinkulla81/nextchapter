'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { syncNowAction } from '@/app/dashboard/email-activity/actions'

export function EmailActivitySyncButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        className={cn(isPending && 'cursor-progress')}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await syncNowAction()
            if (result.error) setError(result.error)
          })
        }}
      >
        {isPending ? 'Checking…' : 'Check now'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
