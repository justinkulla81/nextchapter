'use client'

import { useActionState, useState } from 'react'
import { approvePositioningStatement } from '@/app/dashboard/recruiter-report/actions'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

// Mandatory approval gate (Prompt 47) — the AI draft is never final. The
// candidate edits inline and explicitly approves before it's Dossier-ready.
export function PositioningStatementApproval({
  draftText,
  approvedText,
}: {
  draftText: string
  approvedText: string | null
}) {
  const [state, formAction, pending] = useActionState(approvePositioningStatement, undefined)
  const [text, setText] = useState(approvedText ?? draftText)

  if (approvedText) {
    return <p className="text-sm text-foreground">{approvedText}</p>
  }

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-xs text-muted-foreground italic">
        AI-drafted — review and edit before this appears in your Dossier.
      </p>
      <Textarea
        name="positioningStatementText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton size="sm" pendingLabel="Approving…">
        Approve for my Dossier
      </SubmitButton>
    </form>
  )
}
