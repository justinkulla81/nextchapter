'use client'

import { usePostHog } from 'posthog-js/react'
import type { CandidateProfile } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import type { MatchResult } from '@/lib/matching/compute-match-score'
import { expressInterest, saveCandidate } from '@/app/talent/(app)/roles/[id]/candidates/actions'

function displayIdentity(candidate: Pick<CandidateProfile, 'privacyTier' | 'firstName' | 'lastName' | 'highestLevelReached' | 'primaryFunction'>): string {
  if (candidate.privacyTier === 'PUBLIC' && candidate.firstName) {
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
}) {
  const posthog = usePostHog()

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{displayIdentity(candidate)}</p>
          <p className="text-sm text-muted-foreground">
            {[candidate.primaryFunction, candidate.highestLevelReached, candidate.currentCity]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          {match.label}
        </span>
      </div>
      {effortSummary && <p className="text-xs text-muted-foreground">{effortSummary}</p>}
      <div className="flex gap-2 pt-1">
        <form action={expressInterest.bind(null, candidate.id, roleId)}>
          <SubmitButton
            size="sm"
            onClick={() => posthog?.capture('express_interest_clicked', { candidateId: candidate.id, roleId })}
          >
            Express Interest
          </SubmitButton>
        </form>
        <form action={saveCandidate.bind(null, candidate.id, roleId)}>
          <Button type="submit" variant="outline" size="sm">
            Save for later
          </Button>
        </form>
      </div>
    </div>
  )
}
