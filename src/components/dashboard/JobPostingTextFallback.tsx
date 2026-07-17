'use client'

import { useState } from 'react'
import { submitJobPostingText } from '@/app/dashboard/find-my-job/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'

export function JobPostingTextFallback({
  jobPostingId,
  autoExpand = false,
}: {
  jobPostingId: string
  autoExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(autoExpand)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-sm text-primary underline underline-offset-4"
      >
        Paste the job description text instead
      </button>
    )
  }

  return (
    <form action={submitJobPostingText.bind(null, jobPostingId)} className="space-y-2">
      <Textarea
        name="text"
        rows={6}
        placeholder="Paste the full job description text here…"
        required
      />
      <SubmitButton size="sm" pendingLabel="Analyzing…">
        Analyze this text
      </SubmitButton>
    </form>
  )
}
