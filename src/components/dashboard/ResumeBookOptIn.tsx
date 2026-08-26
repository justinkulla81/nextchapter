'use client'

import { setResumeBookOptIn } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function ResumeBookOptIn({ optedIn }: { optedIn: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-medium text-foreground">Resume Book</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {optedIn
          ? 'Recruiters and hiring managers browsing by role can find your resume here.'
          : "You're not listed — recruiters and hiring managers browsing by role can't find your resume."}
      </p>
      <form action={setResumeBookOptIn.bind(null, !optedIn)} className="mt-3">
        <SubmitButton variant={optedIn ? 'outline' : 'default'} size="sm">
          {optedIn ? 'Remove my resume from the Resume Book' : 'Include my resume in the Resume Book'}
        </SubmitButton>
      </form>
    </div>
  )
}
