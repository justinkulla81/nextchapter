'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Mood } from '@prisma/client'
import { TrendingDown, Minus, TrendingUp, Zap, X, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkInMood, dismissMoodCard } from '@/app/dashboard/actions'
import { MOOD_ORDER, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood-labels'

const MOOD_ICON: Record<Mood, LucideIcon> = {
  STUCK: TrendingDown,
  GETTING_THERE: Minus,
  MOVING: TrendingUp,
  FIRED_UP: Zap,
}

export function MoodCheckInCard({
  todaysMood,
  checkInsLast7Days,
  firstName,
  dismissedToday,
}: {
  todaysMood: Mood | null
  checkInsLast7Days: number
  firstName: string | null
  // Server-computed: whether this was already dismissed today (see
  // moodCardDismissedAt / startOfUTCDay) — resets automatically tomorrow.
  dismissedToday: boolean
}) {
  const router = useRouter()
  const [optimisticMood, setOptimisticMood] = useState<Mood | null>(todaysMood)
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(dismissedToday)

  const mood = optimisticMood ?? todaysMood

  function handleCheckIn(selected: Mood) {
    setOptimisticMood(selected)
    startTransition(async () => {
      await checkInMood(selected)
      // checkInMood's +3 points feed the Weekly A target / grade shown
      // elsewhere on this same page (DashboardTopStrip, SuccessSprintCard) —
      // those are plain server-rendered props from the initial page load,
      // not data this card owns, so router.refresh() is what actually pulls
      // the new total in immediately instead of waiting for the next visit.
      router.refresh()
    })
  }

  function handleDismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissMoodCard()
    })
  }

  if (dismissed) return null

  return (
    <Card aria-busy={isPending}>
      <CardHeader className="relative">
        <div className="flex items-center gap-2 pr-6">
          <CardTitle className="text-base font-medium text-foreground">Check In</CardTitle>
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            +3 pts
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mood ? (
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">
              How are you feeling today{firstName ? `, ${firstName}` : ''}?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOOD_ORDER.map((option) => {
                const Icon = MOOD_ICON[option]
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCheckIn(option)}
                    className="flex flex-col items-center justify-center gap-1 rounded-lg border border-input bg-white px-2 py-3.5 text-xs font-medium transition-colors hover:border-brand hover:bg-brand/5 disabled:cursor-wait"
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-brand" />
                    {MOOD_LABEL[option]}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-foreground">
              <span className="mr-1.5 inline-flex items-center align-text-bottom">
                {(() => {
                  const Icon = MOOD_ICON[mood]
                  return <Icon aria-hidden className="size-4 text-brand" />
                })()}
              </span>
              {MOOD_RESPONSE[mood]}
            </p>
            <p className="text-sm text-foreground">
              {`You've checked in ${checkInsLast7Days} / 7 days. Thanks for sharing, it helps us support you by knowing how you're doing. Keep it up!`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
