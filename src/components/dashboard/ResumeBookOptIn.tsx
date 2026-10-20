'use client'

import { setResumeBookOptIn } from '@/app/dashboard/privacy/actions'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

export function ResumeBookOptIn({ optedIn }: { optedIn: boolean }) {
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
