'use client'

import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { CANDIDATE_PLUS_EXTRAS, CANDIDATE_PLUS_UNLOCK_HREF, type CandidatePlusExtra } from '@/lib/jobs/candidate-plus-extras'

/**
 * Stands in for a Candidate+ extra (who to contact, apply kit, explain my gaps) for a
 * member who hasn't unlocked Candidate+: one honest line, what it does and where to
 * see what's left. No lock wall, no count of what they're missing.
 */
export function CandidatePlusExtraLine({ extra, jobId, surface }: { extra: CandidatePlusExtra; jobId: string; surface: string }) {
  const { label, does } = CANDIDATE_PLUS_EXTRAS[extra]
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {does}. Part of Candidate+ —{' '}
      <Link
        href={CANDIDATE_PLUS_UNLOCK_HREF}
        className="text-primary underline underline-offset-4"
        onClick={() => posthog.capture('candidate_plus_extra_unlock_clicked', { extra, jobId, surface })}
      >
        see what&apos;s left to unlock it
      </Link>
      .
    </p>
  )
}
