'use client'

import { setRecruiterDatabaseOptIn } from '@/app/dashboard/privacy/actions'
import { SubmitButton } from '@/components/ui/submit-button'
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
          {dossierUnlocked ? (
            <span className="font-medium text-success">
              You&apos;re currently surfaced to recruiters — your Dossier is unlocked.
            </span>
          ) : (
            <>
              You&apos;re opted in but not currently surfaced — being matched to roles also requires an
              unlocked Dossier. {renderMarkdownLinks(dossierReason)}
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
