'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { TalentActionForm } from './TalentForms'
import type { TalentFormState } from '@/app/recruiters/(app)/talent/actions'

export type QueueItem = {
  replyId: string
  connectionId: string
  candidateName: string
  kindLabel: string
  reason: string
  subject: string
  body: string
}

export function ReplyQueue({
  items,
  sendingEnabled,
  approve,
  cancel,
  edit,
}: {
  items: QueueItem[]
  sendingEnabled: boolean
  approve: (ids: string[]) => Promise<{ approved: number; sent: number }>
  cancel: (id: string) => Promise<void>
  edit: (prev: TalentFormState, formData: FormData) => Promise<TalentFormState>
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const run = (fn: () => Promise<unknown>, done?: (result: unknown) => void) =>
    start(async () => {
      const result = await fn()
      done?.(result)
      router.refresh()
    })

  const confirmation = (result: unknown) => {
    const r = result as { approved: number; sent: number }
    setMessage(
      sendingEnabled
        ? `Approved ${r.approved}; ${r.sent} sent.`
        : `Approved ${r.approved}. They go out once sending is switched on.`
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="font-medium">No replies waiting.</p>
        <p className="mt-1 text-sm text-muted-foreground">New drafts show up here as candidates come in.</p>
        {message && <p className="mt-3 text-sm text-success">{message}</p>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-progress')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'reply' : 'replies'} drafted in your name. Nothing is sent until you approve.
        </p>
        <Button type="button" disabled={pending} onClick={() => run(() => approve(items.map((i) => i.replyId)), confirmation)}>
          {pending ? 'Approving…' : `Approve all ${items.length}`}
        </Button>
      </div>
      {message && (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.replyId} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/recruiters/talent/${item.connectionId}`} className="font-medium underline-offset-4 hover:underline">
                  {item.candidateName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {item.kindLabel} · {item.reason}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={() => run(() => approve([item.replyId]), confirmation)}>
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditing(editing === item.replyId ? null : item.replyId)}
                >
                  {editing === item.replyId ? 'Close' : 'Edit'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Cancel the reply to ${item.candidateName}? They won't get one.`)) return
                    run(() => cancel(item.replyId), () => setMessage(`Cancelled the reply to ${item.candidateName}.`))
                  }}
                >
                  Don&apos;t send
                </Button>
              </div>
            </div>

            {editing === item.replyId ? (
              <TalentActionForm action={edit} submitLabel="Save reply" className="mt-4">
                <input type="hidden" name="replyId" value={item.replyId} />
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Subject</span>
                  <Input name="subject" defaultValue={item.subject} required />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Message</span>
                  <Textarea name="body" defaultValue={item.body} rows={10} required />
                </label>
              </TalentActionForm>
            ) : (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Preview: {item.subject}</summary>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{item.body}</p>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
