'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setCollegeEmails } from '@/app/i/[slug]/unsubscribe/actions'

// The link in an email's footer lands here. Stopping takes one click (a
// link scanner opening the page changes nothing); undoing is one more.
export function UnsubscribeForm({ slug, token, college, initiallyOn, canUndo }: { slug: string; token: string; college: string; initiallyOn: boolean; canUndo: boolean }) {
  const [on, setOn] = useState(initiallyOn)
  const [undoable, setUndoable] = useState(canUndo)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (next: boolean) =>
    start(async () => {
      setError(null)
      const r = await setCollegeEmails(slug, token, next)
      if (r.error) setError(r.error)
      else {
        setOn(!!r.on)
        setUndoable(true)
      }
    })
  return (
    <div className={cn('space-y-3', pending && 'cursor-wait')}>
      {on ? (
        <>
          <p>Stop emails from {college}? You&apos;ll still be able to sign in and use everything; we just won&apos;t email you.</p>
          <Button size="lg" disabled={pending} onClick={() => run(false)}>
            {pending ? 'Saving…' : 'Stop these emails'}
          </Button>
        </>
      ) : (
        <>
          <p role="status">You won&apos;t get emails from {college} through NextChapter any more.</p>
          {undoable && (
            <Button variant="outline" disabled={pending} onClick={() => run(true)}>
              Turn emails back on
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
