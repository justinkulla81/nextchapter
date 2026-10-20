'use client'

import { setRecruiterDatabaseOptIn } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { renderMarkdownLinks } from '@/lib/text/render-markdown-links'

export function RecruiterDatabaseOptIn({
  optedIn,
  dossierUnlocked,
  dossierReason,
  confidentialSearchMode = false,
  redesign = false,
}: {
  optedIn: boolean
  dossierUnlocked: boolean
  dossierReason: string
  confidentialSearchMode?: boolean
  redesign?: boolean
}) {
  // §4.7 — this opts you into a blanket exposure to every recruiter who
  // searches, with no per-recruiter approval step, which can't coexist with
  // Confidential Search Mode's per-instance consent requirement.
  if (confidentialSearchMode && !optedIn) {
    if (redesign) {
      return (
        <p className="max-w-xl text-base text-ink">
          Not available while Confidential Search Mode is on. Every recruiter who searches could otherwise see your dossier, with no chance for you to approve each one. Your dossier can still reach a specific recruiter through a share link you create yourself, or by turning Confidential Search Mode off.
        </p>
      )
    }
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="font-medium text-foreground">Recruiter database</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unavailable while Confidential Search Mode is on — every recruiter who searches could see
          your Dossier, with no chance for you to approve each one individually. Your Dossier can
          still reach a specific recruiter through a share link you create yourself, or through
          turning Confidential Search Mode off.
        </p>
      </div>
    )
  }

  // The redesign: the page's heading names the setting, so this says where you stand, why, and offers the one change.
  if (redesign) {
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

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-medium text-foreground">Recruiter database</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {optedIn
          ? "You're opted in. Recruiters and employers using NextChapter can find and match against your profile for roles you fit once you're Candidate+."
          : "Not listed by default. Recruiters and employers using NextChapter can only find you if you opt in here and you're Candidate+. This is separate from your privacy tier above."}
      </p>
      {optedIn && (
        <p className="mt-1 text-sm text-muted-foreground">
          {dossierUnlocked ? (
            <span className="font-medium text-success">
              You&apos;re visible to recruiters and employers: you&apos;re Candidate+. Members with references, work samples or
              reviews on file (Candidate+ Verified) are listed first.
            </span>
          ) : (
            <>
              You&apos;re opted in but not visible yet: recruiters and employers only see Candidate+ members.{' '}
              {renderMarkdownLinks(dossierReason)}
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
