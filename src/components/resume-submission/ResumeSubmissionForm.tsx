'use client'

import { useActionState } from 'react'
import { submitResumeLead } from '@/app/submit-resume/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

export function ResumeSubmissionForm() {
  const [state, formAction] = useActionState(submitResumeLead, undefined)

  if (state?.sent) {
    return (
      <div className="rounded-xl border border-light-gray bg-off-white px-6 py-8 text-center">
        <p className="font-semibold text-navy">Got it — thanks for sending your resume.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your email for confirmation. If a recruiter in our network wants to follow up,
          they&apos;ll reach out directly.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-light-gray bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetRole">What role are you targeting? (optional)</Label>
        <Input id="targetRole" name="targetRole" placeholder="e.g. VP of Marketing" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file">Resume (PDF or DOCX, optional but recommended)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton size="lg" variant="cta" pendingLabel="Sending…">
        Submit your resume
      </SubmitButton>
    </form>
  )
}
