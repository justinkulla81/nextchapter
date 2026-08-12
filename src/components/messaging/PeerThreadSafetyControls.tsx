'use client'

import { useState, useActionState } from 'react'
import {
  reportPeerThreadAction,
  blockPeerCandidateAction,
  unblockPeerCandidateAction,
} from '@/app/dashboard/community/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'

// Prompt 85 — one-tap report + immediate, candidate-controlled block, both
// fully self-service: neither needs the other person's or an admin's
// approval to take effect. Report and block are independent — reporting
// doesn't block, and blocking doesn't require a report first.
export function PeerThreadSafetyControls({
  threadId,
  otherCandidateId,
  isBlocked,
  isReported,
}: {
  threadId: string
  otherCandidateId: string
  isBlocked: boolean
  isReported: boolean
}) {
  const [reporting, setReporting] = useState(false)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [reportState, reportAction] = useActionState(reportPeerThreadAction, undefined)
  const reported = isReported || (!!reportState && !reportState.error)

  return (
    <div className="flex shrink-0 items-center gap-3 text-xs">
      {!reported && !reporting && (
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Report
        </button>
      )}
      {reported && <span className="font-medium text-muted-foreground">Reported</span>}

      {isBlocked ? (
        <form action={unblockPeerCandidateAction.bind(null, otherCandidateId)}>
          <SubmitButton variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium">
            Unblock
          </SubmitButton>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingBlock(true)}
          className="text-xs font-medium text-destructive hover:underline"
        >
          Block
        </button>
      )}

      {reporting && !reported && (
        <form action={reportAction} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-4">
            <input type="hidden" name="threadId" value={threadId} />
            <p className="text-sm font-medium text-foreground">Report this conversation</p>
            <p className="text-xs text-muted-foreground">
              An admin will review it — this only opens the messages in this one conversation, not
              your others.
            </p>
            <Textarea name="reason" placeholder="What happened? (optional)" rows={3} />
            {reportState?.error && <p className="text-xs text-destructive">{reportState.error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <SubmitButton size="sm" onClick={() => setReporting(false)}>
                Report conversation
              </SubmitButton>
            </div>
          </div>
        </form>
      )}

      {confirmingBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Block this person?</p>
            <p className="text-xs text-muted-foreground">
              They won&apos;t be able to message you again, and you won&apos;t be able to message
              them. You can unblock them later from this conversation.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingBlock(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <form action={blockPeerCandidateAction.bind(null, otherCandidateId)}>
                <SubmitButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmingBlock(false)}
                >
                  Block candidate
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
