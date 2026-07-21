import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Prompt 60's passive fallback — a non-blocking dashboard nudge for anyone
// with a consented coach who hasn't completed the Coaching Onboarding Form
// yet. The primary path is the explicit redirect right after granting
// consent; this just catches whoever navigated away before finishing.
export function CoachingFormReminderCard() {
  return (
    <div className="rounded-lg border border-border bg-brand/5 p-4">
      <p className="font-medium text-foreground">A few quick questions from your coach</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Standard kickoff questions — goal-setting and how you&apos;d like to work together. Takes a
        couple of minutes.
      </p>
      <Button nativeButton={false} render={<Link href="/dashboard/coaching-form" />} size="sm" className="mt-3">
        Answer now
      </Button>
    </div>
  )
}
