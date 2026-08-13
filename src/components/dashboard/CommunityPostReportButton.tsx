'use client'

import { useState, useActionState } from 'react'
import { reportCommunityPostAction } from '@/app/dashboard/community/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'

// Reuses reportCommunityPostAction (Phase 3) — same one-tap report pattern
// as PeerThreadSafetyControls, sized down for a post instead of a thread
// (no block control here; blocking is a candidate-to-candidate messaging
// concept with no post-level analogue).
export function CommunityPostReportButton({ postId, isReported }: { postId: string; isReported: boolean }) {
  const [reporting, setReporting] = useState(false)
  const [reportState, reportAction] = useActionState(reportCommunityPostAction, undefined)
  const reported = isReported || (!!reportState && !reportState.error)

  if (reported) {
    return <span className="text-xs font-medium text-muted-foreground">Reported</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setReporting(true)}
        className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Report
      </button>
      {reporting && (
        <form action={reportAction} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-4">
            <input type="hidden" name="postId" value={postId} />
            <p className="text-sm font-medium text-foreground">Report this post</p>
            <p className="text-xs text-muted-foreground">
              An admin will review it — this only flags this one post, not the person who posted it.
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
                Report post
              </SubmitButton>
            </div>
          </div>
        </form>
      )}
    </>
  )
}
