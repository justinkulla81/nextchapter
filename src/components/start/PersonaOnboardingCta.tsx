'use client'

import Link from 'next/link'
import { usePostHog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { StartLink } from '@/components/onboarding/StartLink'

export function PersonaOnboardingCta({
  persona,
  situation,
  source,
  label = 'Get your Market Reality Assessment',
}: {
  persona: string
  situation: SituationKey
  /** The page it sits on, when that page already knows who the visitor is ('network:company:<slug>'). */
  source?: string
  label?: string
}) {
  const posthog = usePostHog()

  return (
    <Button
      size="lg"
      variant="cta"
      nativeButton={false}
      render={
        <StartLink
          href={MARKET_REALITY_START_HREF}
          source={`persona_${persona}`.slice(0, 50)}
          situation={situation}
          onNavigate={() => {
            posthog?.capture('persona_landing_cta_clicked', { persona, situation, source })
            sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
          }}
        />
      }
    >
      <AssessmentCtaLabel>{label}</AssessmentCtaLabel>
    </Button>
  )
}
