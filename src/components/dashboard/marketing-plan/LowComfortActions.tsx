'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { pitchPracticeWithCoachAction, shareNarrativeForFeedbackAction } from '@/app/dashboard/marketing-plan/actions'

function SelfReportRow({
  label,
  points,
  action,
}: {
  label: string
  points: number
  action: () => Promise<boolean>
}) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'logged' | 'already'>('idle')

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          +{points} pts
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        className={isPending ? 'mt-2 cursor-wait' : 'mt-2'}
        onClick={() => {
          startTransition(async () => {
            const loggedNow = await action()
            setStatus(loggedNow ? 'logged' : 'already')
            setTimeout(() => setStatus('idle'), 2500)
          })
        }}
      >
        {isPending
          ? 'Logging…'
          : status === 'logged'
            ? 'Logged!'
            : status === 'already'
              ? 'Already logged today'
              : 'I did this'}
      </Button>
    </div>
  )
}

// Low-comfort alternatives to the public-posting actions (LinkedIn post,
// share/repost) — self-report, no verification, same trust level as those
// two. Shown when isLowComfort is true; see marketing-plan/page.tsx.
export function LowComfortActions() {
  return (
    <div className="space-y-3">
      <SelfReportRow
        label="I practiced my pitch with my coach this week"
        points={20}
        action={pitchPracticeWithCoachAction}
      />
      <SelfReportRow
        label="I shared my narrative with a trusted contact for feedback"
        points={10}
        action={shareNarrativeForFeedbackAction}
      />
      <p className="text-sm text-muted-foreground">
        Want to get more comfortable being visible?{' '}
        <Link
          href="/dashboard/learning#speaking-leadership"
          className="font-medium text-primary underline underline-offset-4"
        >
          Toastmasters and public speaking courses →
        </Link>
      </p>
    </div>
  )
}
