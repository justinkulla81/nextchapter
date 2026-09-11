'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { sendBroadcast } from '@/app/support/admin/(portal)/crm/segments/actions'

// The count must be typed back. Not ceremony: this is the only action in the
// CRM that reaches real inboxes, it cannot be undone, and the count is the one
// number that catches a segment that grew from 12 to 1,200 since the draft.
export function CrmBroadcastSend({
  broadcastId, recipientCount, subject,
}: {
  broadcastId: string
  recipientCount: number
  subject: string
}) {
  const bound = sendBroadcast.bind(null, broadcastId)
  const [result, action] = useActionState(
    async (_prev: { ok: boolean; message: string } | null, fd: FormData) => (await bound(fd)) ?? null,
    null
  )

  return (
    <form action={action} className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium">Send “{subject}” to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This sends real email and cannot be undone. Type <strong className="text-foreground">{recipientCount}</strong> to confirm.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="confirmCount" className="sr-only">Type the recipient count to confirm</label>
        <input
          id="confirmCount" name="confirmCount" inputMode="numeric" required
          placeholder={String(recipientCount)}
          className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
        <SubmitButton pendingLabel="Sending…">Send to {recipientCount}</SubmitButton>
      </div>
      {result && (
        <p role="status" className={`mt-2 text-sm ${result.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {result.message}
        </p>
      )}
    </form>
  )
}
