'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { posthog } from '@/lib/posthog/client'
import { PrimaryButtonStyle } from '@/components/dashboard/find/styles'

/** My jobs' one primary action: log a job you found yourself by pasting its address. */
export function AddJobAction({ atCap }: { atCap: boolean }) {
  const [open, setOpen] = useState(false)
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
          <p className="mt-1 mb-3 text-sm text-muted-foreground">Paste the job&apos;s web address. We read the posting, check how you fit and keep it in My jobs.</p>
          {atCap ? (
            <p className="text-sm text-muted-foreground">You have 5 job postings being fit-checked. Remove one under Applications and email activity to add another.</p>
          ) : (
            <JobUrlForm />
          )}
        </DialogPopup>
      </Dialog>
    </>
  )
}
