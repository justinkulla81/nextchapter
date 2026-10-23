'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { recordClaimStart, type ClaimBucket } from '@/app/claim/actions'

// Working: the "growing in a job" journey (employed, search stays confidential by default).
// Between jobs: the laid-off journey. Both start the assessment, which needs no resume.
const SITUATION: Record<ClaimBucket, SituationKey> = { working: 'growing_in_job', between_jobs: 'just_laid_off' }

export function ClaimChoice({ personId, sig }: { personId: string; sig: string }) {
  const router = useRouter()
  const posthog = usePostHog()
  const [pending, setPending] = useState<ClaimBucket | null>(null)

  async function choose(bucket: ClaimBucket) {
    setPending(bucket)
    posthog?.capture('claim_bucket_chosen', { personId, bucket })
    sessionStorage.setItem(SITUATION_SESSION_KEY, SITUATION[bucket])
    try { await recordClaimStart(personId, sig, bucket) } catch { /* never block the claim on the note */ }
    router.push(MARKET_REALITY_START_HREF)
  }

  return (
    <div className="flex flex-wrap justify-center gap-3" aria-busy={pending !== null}>
      <Button size="lg" variant="cta" disabled={pending !== null} onClick={() => choose('working')} className={pending ? 'cursor-wait' : ''}>
        {pending === 'working' ? 'One moment…' : 'I’m working'}
      </Button>
      <Button size="lg" variant="outline" disabled={pending !== null} onClick={() => choose('between_jobs')} className={pending ? 'cursor-wait' : ''}>
        {pending === 'between_jobs' ? 'One moment…' : 'I’m between jobs'}
      </Button>
    </div>
  )
}
