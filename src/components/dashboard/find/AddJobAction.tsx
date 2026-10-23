'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { posthog } from '@/lib/posthog/client'
import { PrimaryButtonStyle } from '@/components/dashboard/find/styles'
import { SaveExternalJobForm } from '@/components/dashboard/find/SaveExternalJobForm'
import { cn } from '@/lib/utils'

/** My jobs' one primary action: log a job you found yourself by pasting its address. */
export function AddJobAction({ atCap }: { atCap: boolean }) {
  const [open, setOpen] = useState(false)
  // Saving is free and instant; the fit check reads the posting with AI and holds one of 5 slots.
  const [mode, setMode] = useState<'save' | 'fit'>('save')
  return (
    <>
      <button
        type="button"
        className={PrimaryButtonStyle}
        onClick={() => {
          setOpen(true)
          posthog.capture('add_job_opened', { source: 'my_jobs', atCap })
        }}
      >
        Add a job
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="w-[min(92vw,32rem)] rounded-xl border border-border bg-background p-5 shadow-lg">
          <DialogClose className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
          <h2 className="pr-8 text-base font-semibold text-ink">Add a job</h2>
          <div role="group" aria-label="How to add it" className="mt-3 mb-3 flex gap-2">
            {(
              [
                ['save', 'Just save it'],
                ['fit', 'Save and check my fit'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m)
                  posthog.capture('add_job_mode_chosen', { mode: m })
                }}
                className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', mode === m ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'save' ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">Found a job on another site? Keep it in My jobs with your notes, follow-up date and checklist.</p>
              <SaveExternalJobForm onSaved={() => setOpen(false)} />
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">Paste the job&apos;s web address. We read the posting, check how you fit and keep it in My jobs.</p>
              {atCap ? (
                <p className="text-sm text-muted-foreground">You have 5 job postings being fit-checked. Remove one under Applications and email activity to add another.</p>
              ) : (
                <JobUrlForm />
              )}
            </>
          )}
        </DialogPopup>
      </Dialog>
    </>
  )
}
