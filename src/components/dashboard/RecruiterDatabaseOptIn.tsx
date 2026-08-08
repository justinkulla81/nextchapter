'use client'

import { setRecruiterDatabaseOptIn } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Grade } from '@/lib/scoring/grade'

export function RecruiterDatabaseOptIn({ optedIn, currentGrade }: { optedIn: boolean; currentGrade: Grade }) {
  const isAGrade = currentGrade === 'A'

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-medium text-foreground">Recruiter database</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {optedIn
          ? "You're opted in. Employers using NextChapter's Talent tools can find and match against your profile for roles you fit."
          : "Not listed by default. Employers using NextChapter's Talent tools can only match you against open roles if you opt in here — this is separate from your privacy tier above."}
      </p>
      {optedIn && (
        <p className="mt-1 text-sm text-muted-foreground">
          {isAGrade ? (
            <span className="font-medium text-success">
              You&apos;re currently surfaced to recruiters — your Current Market Reality is A.
            </span>
          ) : (
            <>
              You&apos;re opted in but not currently surfaced — being matched to roles also requires an A Search
              Action Grade. Your current grade: <span className="font-medium text-foreground">{currentGrade}</span>.
            </>
          )}
        </p>
      )}
      <form action={setRecruiterDatabaseOptIn.bind(null, !optedIn)} className="mt-3">
        <SubmitButton variant={optedIn ? 'outline' : 'default'} size="sm">
          {optedIn ? 'Remove me from the recruiter database' : 'Request to join the recruiter database'}
        </SubmitButton>
      </form>
    </div>
  )
}
