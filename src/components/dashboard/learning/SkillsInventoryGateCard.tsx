'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'
import { AssessmentCtaLink } from '@/components/dashboard/learning/AssessmentCtaLink'

// First card on the Learning page when the Skills Inventory hasn't been
// taken yet — it directly drives what shows up below (job function, AI
// fluency, etc. feed job/course matching, per skills-assessments/page.tsx),
// so an incomplete candidate should see this before anything else.
export function SkillsInventoryGateCard({ candidateId }: { candidateId: string }) {
  useEffect(() => {
    posthog.capture('learn_gate_viewed', { candidateId })
  }, [candidateId])

  return (
    <div className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <p className="text-sm font-medium text-foreground">Unlock your personalized learning plan</p>
      <p className="text-sm text-muted-foreground">
        Your core function, AI fluency, and a few other skills decide which courses and tools we recommend. The
        sections marked as locked below are previews — take the skills assessment and they fill in with picks matched
        to you.
      </p>
      <AssessmentCtaLink source="learn_gate" />
    </div>
  )
}
