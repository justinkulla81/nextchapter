'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'

// Renders in the Daily Message slot on the Learning page (via
// PageHeaderBoxes' dailyMessageOverride) — same bordered/tinted card
// treatment as DailyMessageBox, so this doesn't stack as a second
// near-identical "personalized message" card below the generic one.
export function AssessmentLinkCard({ hasTakenAssessment }: { hasTakenAssessment: boolean }) {
  const posthog = usePostHog()

  return (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
      <p className="text-sm font-medium text-foreground">
        {hasTakenAssessment
          ? 'Your Skills and Behavioral Assessment shapes these recommendations'
          : 'Not sure where to start?'}
      </p>
      <p className="text-sm text-muted-foreground">
        {hasTakenAssessment
          ? 'These recommendations also draw on your Skills and Behavioral Assessment results — how you work, what motivates you, and where you feel least confident. Retake it if your working style has changed.'
          : 'The Skills and Behavioral Assessment maps how you actually work — your confidence, motivation, and working style — so the courses below can be tailored to you, not just your resume.'}
      </p>
      <Link
        href="/dashboard/retake-assessment"
        onClick={() => posthog?.capture('learning_assessment_link_clicked', { hasTakenAssessment })}
        className="inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        {hasTakenAssessment ? 'Retake the Behavioral Assessment' : 'Take the Behavioral Assessment'}
      </Link>
    </div>
  )
}
