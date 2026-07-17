'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import {
  requestJobThankYouNote,
  markJobThankYouSent,
} from '@/app/dashboard/find-my-job/actions'

const MIN_CHARS = 10

export function ThankYouNoteCard({
  jobPostingId,
  note,
  error,
  sentAt,
}: {
  jobPostingId: string
  note: string | null
  error: string | null
  sentAt: Date | null
}) {
  const [whatCameUp, setWhatCameUp] = useState('')

  if (sentAt) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-3">
        <p className="text-sm text-success">Thank you note marked as sent.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium">Send a thank you note while it&apos;s fresh.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Candidates who send specific notes within 24 hours stand out. What came up in the
          interview?
        </p>
      </div>

      <form action={requestJobThankYouNote.bind(null, jobPostingId)} className="space-y-2">
        <Textarea
          name="whatCameUp"
          rows={3}
          value={whatCameUp}
          onChange={(e) => setWhatCameUp(e.target.value)}
          placeholder="e.g. We talked about their plans to expand into enterprise, the Q3 launch, and the team structure challenge they're working through."
        />
        <SubmitButton variant="outline" size="sm" disabled={whatCameUp.trim().length < MIN_CHARS}>
          Generate my note →
        </SubmitButton>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {note && (
        <div className="space-y-2 border-t border-border pt-3">
          <Textarea readOnly rows={6} value={note} className="text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(note)}
            >
              Copy
            </Button>
            <form action={requestJobThankYouNote.bind(null, jobPostingId)}>
              <input type="hidden" name="whatCameUp" value={whatCameUp} />
              <SubmitButton variant="outline" size="sm">
                Try another version
              </SubmitButton>
            </form>
            <form action={markJobThankYouSent.bind(null, jobPostingId)}>
              <SubmitButton variant="outline" size="sm">
                Mark as sent
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
