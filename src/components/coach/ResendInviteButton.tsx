'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { resendCoachClientInvite } from '@/app/support/coach/(app)/invite-client/actions'

export function ResendInviteButton({ inviteId }: { inviteId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; sent?: boolean } | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await resendCoachClientInvite(inviteId)
      setResult(res ?? null)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className={isPending ? 'cursor-progress' : undefined}
      >
        {isPending ? 'Resending…' : 'Resend'}
      </Button>
      {result?.error && <p className="text-xs text-destructive">{result.error}</p>}
      {result?.sent && <p className="text-xs text-brand">Resent.</p>}
    </div>
  )
}
