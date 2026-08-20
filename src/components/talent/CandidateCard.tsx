'use client'

import { usePostHog } from 'posthog-js/react'
import type { CandidateProfile } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import type { MatchResult } from '@/lib/matching/compute-match-score'
import { expressInterest, saveCandidate } from '@/app/talent/(app)/roles/[id]/candidates/actions'

function displayIdentity(
  candidate: Pick<CandidateProfile, 'privacyTier' | 'firstName' | 'lastName' | 'highestLevelReached' | 'primaryFunction'>,
  // Locked (Dossier not unlocked) candidates stay anonymized regardless of
  // their own privacyTier choice — the teaser is the same for everyone
  // until real evidence/effort is on file, not something a PUBLIC-tier
  // candidate can opt out of by their privacy setting alone.
  locked: boolean
): string {
  if (!locked && candidate.privacyTier === 'PUBLIC' && candidate.firstName) {
    return `${candidate.firstName} ${candidate.lastName?.charAt(0) ?? ''}.`.trim()
  }
  const level = candidate.highestLevelReached ?? 'Experienced'
  const fn = candidate.primaryFunction ?? 'professional'
  return `${level} ${fn} professional`
}

export function CandidateCard({
  candidate,
  match,
  roleId,
  effortSummary,
  roleLabel,
  locked = false,
}: {
  candidate: Pick<
    CandidateProfile,
    'id' | 'privacyTier' | 'firstName' | 'lastName' | 'highestLevelReached' | 'primaryFunction' | 'currentCity' | 'remotePreference'
  >
  match: MatchResult
  roleId: string
  // Condensed version of the same effort-summary facts shown in the full
  // Evidence Brief (computeEffortSummaryLines) — narrative/counts only,
  // never the raw grade, same rule as everywhere else external audiences see.
  effortSummary?: string
  // Which posted role this candidate best matched against — only meaningful
  // on the cross-role discovery view, where a candidate could match several
  // of the employer's active roles. Match Inbox (single-role context) omits
  // this since the role is already the page's subject.
  roleLabel?: string
  // Dossier not yet unlocked — a real match, shown as a teaser (name
  // withheld, no Save/Compare) rather than filtered out entirely. Express
  // Interest still works: it's the same expressInterest action every
  // unlocked candidate uses, which already emails the candidate and shows
  // up in their dashboard's employer-interest inbox — a locked candidate
  // who hears a real employer is interested has real reason to finish
  // unlocking, and the employer already registered interest for when they do.
  locked?: boolean
}) {
  const posthog = usePostHog()

  return (
    <div className={locked ? 'space-y-2 rounded-lg border border-dashed border-border p-4' : 'space-y-2 rounded-lg border border-border p-4'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{displayIdentity(candidate, locked)}</p>
          <p className="text-sm text-muted-foreground">
            {[candidate.primaryFunction, candidate.highestLevelReached, candidate.currentCity]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {locked && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Name unlocks once their Executive Dossier completes.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            {match.label}
          </span>
          {roleLabel && <span className="text-xs text-muted-foreground">{roleLabel}</span>}
        </div>
      </div>
      {effortSummary && <p className="text-xs text-muted-foreground">{effortSummary}</p>}
      <div className="flex gap-2 pt-1">
        <form action={expressInterest.bind(null, candidate.id, roleId)}>
          <SubmitButton
            size="sm"
            onClick={() => posthog?.capture('express_interest_clicked', { candidateId: candidate.id, roleId, locked })}
          >
            {locked ? "I'm interested — notify me" : 'Express Interest'}
          </SubmitButton>
        </form>
        {!locked && (
          <form action={saveCandidate.bind(null, candidate.id, roleId)}>
            <Button type="submit" variant="outline" size="sm">
              Save for later
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
