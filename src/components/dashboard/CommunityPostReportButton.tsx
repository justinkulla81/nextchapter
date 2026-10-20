'use client'

import { useState, useActionState } from 'react'
import { reportCommunityPostAction } from '@/app/dashboard/community/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// Reuses reportCommunityPostAction (Phase 3) — same one-tap report pattern
// as PeerThreadSafetyControls, sized down for a post instead of a thread
// (no block control here; blocking is a candidate-to-candidate messaging
// concept with no post-level analogue). `redesign` is the same control at
// body size, with the same confirmation dialog.
export function CommunityPostReportButton({ postId, isReported, redesign = false }: { postId: string; isReported: boolean; redesign?: boolean }) {
  const [reporting, setReporting] = useState(false)
  const [reportState, reportAction] = useActionState(reportCommunityPostAction, undefined)
  const reported = isReported || (!!reportState && !reportState.error)

  if (reported) {
    return <span className={cn('font-medium text-muted-foreground', redesign ? 'px-4 text-sm' : 'text-xs')}>Reported</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setReporting(true)}
        className={cn(
          'font-medium text-muted-foreground hover:text-foreground',
          redesign ? 'inline-flex h-10 items-center rounded-full px-4 text-sm hover:bg-muted' : 'text-xs underline underline-offset-4'
        )}
      >
        Report
      </button>
      {reporting && (
        <form action={reportAction} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className={cn('w-full max-w-sm space-y-3 border border-border bg-card p-4', redesign ? 'rounded-2xl p-6' : 'rounded-lg')}>
            <input type="hidden" name="postId" value={postId} />
            <p className={cn('font-medium text-foreground', redesign ? 'text-base' : 'text-sm')}>Report this post</p>
            <p className={cn('text-muted-foreground', redesign ? 'text-sm' : 'text-xs')}>
              An admin will review it — this only flags this one post, not the person who posted it.
            </p>
            <Textarea name="reason" placeholder="What happened? (optional)" rows={3} />
            {reportState?.error && <p className={cn('text-destructive', redesign ? 'text-sm' : 'text-xs')}>{reportState.error}</p>}
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
