'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'

export function AssessmentLinkCard({ hasTakenAssessment }: { hasTakenAssessment: boolean }) {
  const posthog = usePostHog()

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">
        {hasTakenAssessment ? 'Your Behavioral Assessment shapes these recommendations' : 'Not sure where to start?'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasTakenAssessment
          ? 'These recommendations also draw on your Behavioral Assessment results — how you work, what motivates you, and where you feel least confident. Retake it if your working style has changed.'
          : 'The Behavioral Assessment maps how you actually work — your confidence, motivation, and working style — so the courses below can be tailored to you, not just your resume.'}
      </p>
      <Link
        href="/dashboard/retake-assessment"
        onClick={() => posthog?.capture('learning_assessment_link_clicked', { hasTakenAssessment })}
        className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        {hasTakenAssessment ? 'Retake the Behavioral Assessment' : 'Take the Behavioral Assessment'}
      </Link>
    </div>
  )
}
