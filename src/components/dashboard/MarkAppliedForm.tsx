'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { APPLICATION_CHANNEL_LABELS } from '@/lib/jobs/conversion-diagnostic'

export function MarkAppliedForm({
  jobPostingId,
  markApplied,
  isAtCurrentEmployer = false,
}: {
  jobPostingId: string
  markApplied: (jobPostingId: string, formData: FormData) => Promise<void>
  // §4.8: "Warn before applying to their current employer or a known
  // subsidiary." Computed server-side (find-my-job/page.tsx) against the
  // candidate's own WorkHistoryEntry, only ever true while confidential.
  isAtCurrentEmployer?: boolean
}) {
  const [confirmed, setConfirmed] = useState(false)

  if (isAtCurrentEmployer && !confirmed) {
    return (
      <div className="max-w-xs space-y-2 rounded-md border border-orange/40 bg-orange/5 p-2 text-xs">
        <p className="text-foreground">
          This looks like your current employer or a related company. Applying here could reveal your
          search internally.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmed(true)}>
          I understand — continue
        </Button>
      </div>
    )
  }

  return (
    <form action={markApplied.bind(null, jobPostingId)} className="flex items-center gap-2">
      <Select name="channel" defaultValue="COLD_APPLICATION">
        <SelectTrigger size="sm" aria-label="How did you apply?">
          <SelectValue placeholder="How did you apply?">
            {(value: string | null) =>
              value
                ? APPLICATION_CHANNEL_LABELS[value as keyof typeof APPLICATION_CHANNEL_LABELS]
                : 'How did you apply?'
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(APPLICATION_CHANNEL_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SubmitButton variant="outline" size="sm">
        Applied
      </SubmitButton>
    </form>
  )
}
