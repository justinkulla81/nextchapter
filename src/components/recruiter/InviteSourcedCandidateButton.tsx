'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { inviteSourcedCandidate } from '@/app/recruiters/(app)/candidates/actions'

export function InviteSourcedCandidateButton({
  candidateId,
  alreadyInvited,
}: {
  candidateId: string
  alreadyInvited: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; sent?: boolean } | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await inviteSourcedCandidate(candidateId)
      setResult(res ?? null)
    })
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={isPending ? 'cursor-progress' : undefined}
      >
        {isPending ? 'Sending…' : alreadyInvited ? 'Resend invite' : 'Invite to NextChapter'}
      </Button>
      {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
      {result?.sent && <p className="text-sm text-brand">Invite sent.</p>}
    </div>
  )
}
