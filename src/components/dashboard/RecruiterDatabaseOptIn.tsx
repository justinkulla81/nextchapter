'use client'

import { setRecruiterDatabaseOptIn } from '@/app/dashboard/privacy/actions'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { renderMarkdownLinks } from '@/lib/text/render-markdown-links'

export function RecruiterDatabaseOptIn({
  optedIn,
  dossierUnlocked,
  dossierReason,
  confidentialSearchMode = false,
}: {
  optedIn: boolean
  dossierUnlocked: boolean
  dossierReason: string
  confidentialSearchMode?: boolean
}) {
  // §4.7 — this opts you into a blanket exposure to every recruiter who
  // searches, with no per-recruiter approval step, which can't coexist with
  // Confidential Search Mode's per-instance consent requirement.
  if (confidentialSearchMode && !optedIn) {
    return (
      <p className="max-w-xl text-base text-ink">
        Not available while Confidential Search Mode is on. Every recruiter who searches could otherwise see your dossier, with no chance for you to approve each one. Your dossier can still reach a specific recruiter through a share link you create yourself, or by turning Confidential Search Mode off.
      </p>
    )
  }

  // The redesign: the page's heading names the setting, so this says where you stand, why, and offers the one change.
  return (
    <div className="space-y-3">
      <p className="max-w-xl text-base text-ink">
        {optedIn
          ? 'You are opted in. Recruiters and employers using NextChapter can find and match against your profile for roles you fit once you are Candidate+.'
          : 'You are not listed. Recruiters and employers using NextChapter can only find you if you opt in here and you are Candidate+. This is separate from who can see your profile above.'}
      </p>
      {optedIn && (
        <p className="max-w-xl text-base text-ink">
          {dossierUnlocked ? (
            'You are visible to recruiters and employers because you are Candidate+. Members with references, work samples or reviews on file are listed first.'
          ) : (
            <>
              You are not visible yet, because recruiters and employers only see Candidate+ members. {renderMarkdownLinks(dossierReason)}
            </>
          )}
        </p>
      )}
      <form action={setRecruiterDatabaseOptIn.bind(null, !optedIn)}>
        <ActionSubmit variant="secondary" pendingLabel="Saving…" event="recruiter_database_opt_in_changed" props={{ optedIn: !optedIn }}>
          {optedIn ? 'Remove me from the recruiter database' : 'Request to join the recruiter database'}
        </ActionSubmit>
      </form>
    </div>
  )
}
