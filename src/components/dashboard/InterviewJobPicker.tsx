'use client'

import { useState } from 'react'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { SubmitButton } from '@/components/ui/submit-button'
import type { FormState } from '@/app/dashboard/find-my-job/actions'

const ADD_JOB_VALUE = '__add_job__'

interface EligiblePosting {
  id: string
  companyName: string | null
  title: string | null
}

// Replaces the old separate "Add a job link for this interview" <details>
// disclosure — picking a not-yet-tracked job is now just another option in
// the same "Which job?" select, which reveals the add-job form inline
// instead of living as a second, easy-to-miss control below it.
export function InterviewJobPicker({
  eligibleForInterview,
  atCap,
  markInterviewLandedFromForm,
  addInterviewJob,
}: {
  eligibleForInterview: EligiblePosting[]
  atCap: boolean
  markInterviewLandedFromForm: (formData: FormData) => Promise<void>
  addInterviewJob: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [selected, setSelected] = useState('')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="" disabled>
            Which job?
          </option>
          {eligibleForInterview.map((posting) => (
            <option key={posting.id} value={posting.id}>
              {posting.companyName ?? 'Unknown company'}
              {posting.title ? ` — ${posting.title}` : ''}
            </option>
          ))}
          <option value={ADD_JOB_VALUE}>+ Add a job not shown</option>
        </select>

        {selected && selected !== ADD_JOB_VALUE && (
          <form action={markInterviewLandedFromForm}>
            <input type="hidden" name="jobPostingId" value={selected} />
            <SubmitButton variant="outline" size="sm">
              I have an interview for this job
            </SubmitButton>
          </form>
        )}
      </div>

      {selected === ADD_JOB_VALUE &&
        (atCap ? (
          <p className="text-sm text-muted-foreground">
            You have 5 job postings tracked — remove one below to add another.
          </p>
        ) : (
          <JobUrlForm action={addInterviewJob} submitLabel="I'm interviewing — add job" />
        ))}
    </div>
  )
}
