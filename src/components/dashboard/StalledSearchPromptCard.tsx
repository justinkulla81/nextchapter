'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  recordStalledSearchPromptShown,
  respondToStalledSearchPrompt,
  recordStalledSearchSuggestionClicked,
  type StalledSearchSuggestion,
} from '@/app/dashboard/actions'
import type { StalledSearchTier } from '@/lib/dashboard/stalled-search-prompt'

export function StalledSearchPromptCard({
  tier,
  weeksStreak,
  showInterimSuggestion,
  showCoachSuggestion,
}: {
  tier: StalledSearchTier
  weeksStreak: number
  showInterimSuggestion: boolean
  showCoachSuggestion: boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  // Fires once, the moment the card is actually painted — starts the real
  // 14-day throttle. See recordStalledSearchPromptShown for why this can't
  // happen during server render.
  useEffect(() => {
    startTransition(() => {
      recordStalledSearchPromptShown(tier, weeksStreak)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dismissed) return null

  function respond(choice: 'ACKNOWLEDGED' | 'DONT_ASK_AGAIN') {
    setDismissed(true)
    startTransition(() => {
      respondToStalledSearchPrompt(choice, tier)
    })
  }

  function trackClick(suggestion: StalledSearchSuggestion) {
    startTransition(() => {
      recordStalledSearchSuggestionClicked(suggestion, tier)
    })
  }

  return (
    <Card className={cn('border-brand/30 bg-brand/5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm font-medium text-foreground">
          {tier === 1 ? "You're doing the work — it's not converting yet" : "It's been a full month with no interviews"}
        </p>
        <p className="text-sm text-muted-foreground">
          You&apos;ve hit both your application and outreach goals for {weeksStreak} weeks straight, with no
          interviews to show for it yet. Worth checking whether your applications are actually in line with
          your qualifications, experience, and target role — not every fit issue shows up until several
          applications in.
        </p>
        {tier === 2 && (
          <p className="text-sm text-muted-foreground">
            Two more things worth trying: committing to a few more applications and outreach messages than
            usual next week, and reconsidering whether your current target role is the right one for right
            now.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/find-my-job" onClick={() => trackClick('FIT_CHECK')} />}
            size="sm"
          >
            Review my applications&apos; fit
          </Button>
          {tier === 2 && (
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/search-strategy" onClick={() => trackClick('ALTERNATIVE_TARGET')} />}
              size="sm"
              variant="outline"
            >
              Reconsider my target role
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {showInterimSuggestion && (
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/interim-work" onClick={() => trackClick('INTERIM_WORK')} />}
              size="sm"
              variant="ghost"
            >
              Explore interim work
            </Button>
          )}
          {showCoachSuggestion && (
            <Button
              nativeButton={false}
              render={<Link href="/coaching" onClick={() => trackClick('COACH')} />}
              size="sm"
              variant="ghost"
            >
              Talk to a coach
            </Button>
          )}
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/premium" onClick={() => trackClick('EXECUTIVE_PLAN')} />}
            size="sm"
            variant="ghost"
          >
            Get a personal executive recruiter
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => respond('ACKNOWLEDGED')}>
            Got it
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => respond('DONT_ASK_AGAIN')}>
            Don&apos;t ask again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
