'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { DISMISS_REASONS, type DismissReason } from '@/lib/jobs/job-dismiss'
import { dismissBoardJob, type DismissResult } from '@/app/dashboard/find-my-job/dismiss-actions'

/**
 * The X on a board job card: pass on it with quick reasons (several can be picked) and an
 * optional note. The reasons teach the board (job-dismiss.ts): a company is hidden at once,
 * repeated industry / title / level / location reasons move similar jobs down, pay sets a floor.
 */
export function DismissJobButton({
  jobId,
  title,
  companyName,
  onDismissed,
}: {
  jobId: string
  title: string
  companyName: string | null
  onDismissed: (result: DismissResult, reasons: DismissReason[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [reasons, setReasons] = useState<DismissReason[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(r: DismissReason) {
    setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await dismissBoardJob(jobId, reasons, note).catch(() => null)
      if (!result?.ok) {
        setError('Could not hide this job. Try again in a moment.')
        return
      }
      posthog.capture('job_dismissed', { jobId, reasons, hasNote: note.trim().length > 0 })
      setOpen(false)
      onDismissed(result, reasons)
    })
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Pass on ${title}${companyName ? ` at ${companyName}` : ''}`}
        title="Not for me"
        onClick={(e) => {
          // Inside the card's <summary>: don't open the card.
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="w-[min(92vw,28rem)] rounded-xl border border-border bg-background p-5 shadow-lg">
          <DialogClose className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
          <h2 className="pr-8 text-base font-semibold text-foreground">Why isn&apos;t this one for you?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {title}
            {companyName ? ` at ${companyName}` : ''}. Pick any that apply — we&apos;ll use them to tune your jobs and emails.
          </p>
          <div role="group" aria-label="Reasons" className="mt-3 flex flex-wrap gap-2">
            {DISMISS_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={reasons.includes(r.key)}
                onClick={() => toggle(r.key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  reasons.includes(r.key) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm text-muted-foreground">
            Anything else? (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={submit} disabled={pending} aria-busy={pending} className={cn(pending && 'cursor-wait')}>
              {pending ? 'Hiding…' : 'Hide this job'}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </>
  )
}
