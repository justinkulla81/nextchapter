'use client'

import { setResumeBookOptIn } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

export function ResumeBookOptIn({ optedIn, redesign = false }: { optedIn: boolean; redesign?: boolean }) {
  if (redesign) {
    return (
      <div className="space-y-3">
        <p className="max-w-xl text-base text-ink">
          {optedIn
            ? 'You are listed. Recruiters and hiring managers browsing by role can find your résumé.'
            : 'You are not listed, so recruiters and hiring managers browsing by role cannot find your résumé.'}
        </p>
        <form action={setResumeBookOptIn.bind(null, !optedIn)}>
          <ActionSubmit variant="secondary" pendingLabel="Saving…" event="resume_book_opt_in_changed" props={{ optedIn: !optedIn }}>
            {optedIn ? 'Remove my résumé from the Résumé Book' : 'Include my résumé in the Résumé Book'}
          </ActionSubmit>
        </form>
      </div>
    )
  }
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
