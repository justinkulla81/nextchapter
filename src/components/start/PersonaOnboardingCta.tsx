'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Button } from '@/components/ui/button'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'

export function PersonaOnboardingCta({
  persona,
  situation,
}: {
  persona: string
  situation: SituationKey
}) {
  const posthog = usePostHog()

  return (
    <Button
      size="lg"
      variant="cta"
      nativeButton={false}
      render={
        <Link
          href="/onboarding/desire"
          onClick={() => {
            posthog?.capture('persona_landing_cta_clicked', { persona, situation })
            sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
          }}
        />
      }
    >
      Get your Market Reality Assessment
    </Button>
  )
}
