'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { HomeModule } from './HomeModule'

export type RecruiterGoalStep = { key: string; need: string; href: string; action: string }

/**
 * "Get seen by recruiters": recruiters and employers only see Candidate+ members who
 * opted in. Lists exactly what is left (the unlock ladder's Candidate+ steps, plus the
 * opt-in when it's missing) with one button for the first. Home only; no emails.
 */
export function RecruiterVisibilityGoalCard({ steps }: { steps: RecruiterGoalStep[] }) {
  if (steps.length === 0) return null
  const [next] = steps
  return (
    <HomeModule title="Get seen by recruiters">
      <p className="text-sm text-muted-foreground">
        Recruiters and employers on NextChapter only see Candidate+ members who have opted in. Here is what&apos;s left:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {steps.map((s) => (
          <li key={s.key} className={s.key === next.key ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {s.need}
          </li>
        ))}
      </ol>
      <Button
        nativeButton={false}
        render={<Link href={next.href} />}
        size="sm"
        onClick={() => posthog.capture('recruiter_visibility_goal_clicked', { step: next.key, remaining: steps.length })}
      >
        {next.action}
      </Button>
    </HomeModule>
  )
}
