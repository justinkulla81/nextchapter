'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'

// Sits inside the <form> so useFormStatus sees this exact submission —
// closes the parent details box once the pending→settled transition
// completes, instead of leaving it open after a successful save.
function CollapseOnSuccess({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending) onDone()
    wasPending.current = pending
  }, [pending, onDone])
  return null
}

export function JobDetailsEditor({
  initialTitle,
  initialUrl,
  companyName,
  action,
}: {
  initialTitle: string | null
  initialUrl: string | null
  companyName: string | null
  action: (formData: FormData) => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const narrativeHref = `/dashboard/marketing-plan?${new URLSearchParams({
    label: companyName ?? 'This job',
    scenario: `Applying for ${initialTitle || 'a role'} at ${companyName ?? 'this company'} — tailor my story for it.`,
  }).toString()}#tailored-narratives`

  return (
    <details
      className="group rounded-md border border-border p-3 text-xs"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium text-foreground">
        Personalize &amp; see your fit
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <CollapseOnSuccess onDone={() => setOpen(false)} />
        <div className="space-y-1">
          <label htmlFor="job-title" className="text-xs font-medium text-foreground">
            Job title
          </label>
          <Input id="job-title" name="title" defaultValue={initialTitle ?? ''} placeholder="e.g. Senior Product Manager" />
        </div>
        <div className="space-y-1">
          <label htmlFor="job-url" className="text-xs font-medium text-foreground">
            Posting link (optional — private, only you see it)
          </label>
          <Input id="job-url" name="url" type="url" defaultValue={initialUrl ?? ''} placeholder="https://" />
        </div>
        <SubmitButton variant="outline" size="sm">
          Save
        </SubmitButton>
      </form>
      <Link
        href={narrativeHref}
        className="mt-3 block text-xs font-medium text-primary underline underline-offset-4"
      >
        Draft a narrative for this job →
      </Link>
    </details>
  )
}
