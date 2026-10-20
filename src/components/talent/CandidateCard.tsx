'use client'

import { usePostHog } from '@/lib/posthog/client'
import type { CandidateProfile } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import type { MatchResult } from '@/lib/matching/compute-match-score'
import { expressInterest, saveCandidate } from '@/app/talent/(app)/roles/[id]/candidates/actions'
import { candidateDisplayName } from '@/lib/talent/candidate-identity'
import { EvidenceBadge } from '@/components/evidence/EvidenceBadge'

export function CandidateCard({
  candidate,
  match,
  roleId,
  effortSummary,
  roleLabel,
  evidence,
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
  // Candidate+ Verified + evidence score. Only Candidate+ members reach this
  // card at all (Candidate+ is the only gate for employer visibility).
  evidence?: { verified: boolean; score: number }
}) {
  const posthog = usePostHog()

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium text-foreground">
            {candidateDisplayName(candidate, false)}
            <span
              className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white"
              title="Candidate+: real outreach, applications, search effort and an assessment on file"
            >
              Candidate+
            </span>
            {evidence && <EvidenceBadge verified={evidence.verified} score={evidence.score} />}
          </p>
          <p className="text-sm text-muted-foreground">
            {[candidate.primaryFunction, candidate.highestLevelReached, candidate.currentCity]
              .filter(Boolean)
              .join(' · ')}
          </p>
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
            onClick={() =>
              posthog?.capture('express_interest_clicked', { candidateId: candidate.id, roleId, verified: evidence?.verified ?? false })
            }
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
