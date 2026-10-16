'use client'

import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'

// The single "take the assessment" action on the Learn page. Every instance
// reports where it was clicked so we can see which prompt converts.
export function AssessmentCtaLink({ source, variant = 'primary' }: { source: 'learn_gate' | 'learn_locked_preview'; variant?: 'primary' | 'inline' }) {
  return (
    <Link
      href="/dashboard/skills-assessment"
      onClick={() => posthog.capture('skills_assessment_started', { source })}
      className={
        variant === 'primary'
          ? 'inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'
          : 'text-sm font-medium text-primary underline underline-offset-4'
      }
    >
      Take the skills assessment
    </Link>
  )
}
