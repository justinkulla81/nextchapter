'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { connectBoard, disconnectBoard, setShareIdentity, setShareOutcome } from '@/app/dashboard/local-market/actions'

type Board = { id: string; name: string; website: string | null }
type Connection = { boardId: string; name: string; shareOutcome: boolean; shareIdentity: boolean }

// Working with a workforce board? Say so, and choose whether to be counted,
// anonymously, among the members who found work. The board sees a name only
// if the member turns on "Share my name" (off by default; Confidential Search
// Mode overrides it). On the privacy page it shows only the boards you work with.
export function WorkforceBoardPanel({ boards, connections, confidential = false, variant = 'local' }: { boards: Board[]; connections: Connection[]; confidential?: boolean; variant?: 'local' | 'privacy' }) {
  const router = useRouter()
  const posthog = usePostHog()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const connectedIds = new Set(connections.map((c) => c.boardId))

  const run = (fn: () => Promise<{ error?: string }>, event: string, props: Record<string, unknown>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (r.error) return setError(r.error)
      posthog?.capture(event, props)
      setConfirming(null)
      router.refresh()
    })

  return (
    <section {...(variant === 'local' ? { 'aria-labelledby': 'boards' } : { 'aria-label': 'Workforce boards you work with' })} className={cn('space-y-3', pending && 'cursor-wait')}>
      {variant === 'local' && (
        <>
          <h2 id="boards" className="text-base font-semibold">
            Working with a workforce board?
          </h2>
          <p className="text-sm text-muted-foreground">
            Workforce boards run the job centers and training programs in your area. Tell us if you work with one, and we will keep you in step with its area. The board
            sees you only in anonymous counts unless you choose to share your name.
          </p>
        </>
      )}

      {connections.map((c) => (
        <div key={c.boardId} className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">{c.name}</p>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`share-${c.boardId}`}
              checked={c.shareOutcome}
              disabled={pending}
              onCheckedChange={(v) => run(() => setShareOutcome(c.boardId, v === true), 'workforce_board_share_changed_clicked', { boardId: c.boardId, share: v === true })}
            />
            <Label htmlFor={`share-${c.boardId}`} className="font-normal">
              Count me, anonymously, if I find work. The board sees a number, never my name, and only once at least 10 members are included.
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`identity-${c.boardId}`}
              checked={c.shareIdentity && !confidential}
              disabled={pending || confidential}
              onCheckedChange={(v) => run(() => setShareIdentity(c.boardId, v === true), 'workforce_board_share_identity_clicked', { boardId: c.boardId, share: v === true })}
              className="mt-0.5"
            />
            <Label htmlFor={`identity-${c.boardId}`} className="font-normal leading-snug">
              Share my name with {c.name}, so its staff can contact me about its services. They see my name, email, city and state, and my situation. Never my résumé, activity or grade. Off until I turn it on.
              {confidential && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Off while Confidential Search Mode is on. Turn that off in your privacy settings to share your name.
                </span>
              )}
            </Label>
          </div>
          {confirming === c.boardId ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Stop working with {c.name} on NextChapter?</span>
              <button type="button" disabled={pending} onClick={() => run(() => disconnectBoard(c.boardId), 'workforce_board_disconnect_clicked', { boardId: c.boardId })} className="rounded-md border border-destructive px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
                {pending ? 'Stopping…' : 'Yes, stop'}
              </button>
              <button type="button" onClick={() => setConfirming(null)} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(c.boardId)} className="text-xs text-muted-foreground underline underline-offset-4">
              Stop working with this board
            </button>
          )}
        </div>
      ))}

      {boards.filter((b) => !connectedIds.has(b.id)).length > 0 && (
        <ul className="space-y-2">
          {boards
            .filter((b) => !connectedIds.has(b.id))
            .map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <span className="text-sm">
                  {b.name}
                  {b.website && (
                    <>
                      {' '}
                      <a href={b.website.startsWith('http') ? b.website : `https://${b.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-4">
                        website
                      </a>
                    </>
                  )}
                </span>
                <button type="button" disabled={pending} onClick={() => run(() => connectBoard(b.id), 'workforce_board_connect_clicked', { boardId: b.id })} className="rounded-md border border-brand px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/10 disabled:opacity-60">
                  {pending ? 'Saving…' : 'I work with this board'}
                </button>
              </li>
            ))}
        </ul>
      )}

      {boards.length === 0 && connections.length === 0 && <p className="text-sm text-muted-foreground">We have no workforce boards listed for your state yet.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
