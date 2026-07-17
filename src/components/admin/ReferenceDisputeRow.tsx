'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { resolveReferenceDispute } from '@/app/support/admin/reference-disputes/actions'
import { cn } from '@/lib/utils'

interface ReferenceDisputeRowProps {
  id: string
  candidateName: string
  candidateEmail: string
  refereeName: string
  note: string
  disputedAt: string
}

export function ReferenceDisputeRow({
  id,
  candidateName,
  candidateEmail,
  refereeName,
  note,
  disputedAt,
}: ReferenceDisputeRowProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-2 rounded-lg border border-border p-4', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="font-medium text-foreground">
        {candidateName} <span className="text-muted-foreground">({candidateEmail})</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Disputing reference from {refereeName} · flagged {disputedAt}
      </p>
      <p className="rounded-md bg-muted/50 p-2 text-sm text-foreground">&quot;{note}&quot;</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => resolveReferenceDispute(id))}
      >
        Mark resolved (restore to Executive Dossier)
      </Button>
    </div>
  )
}
