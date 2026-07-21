'use client'

import { useState, useTransition } from 'react'
import type { Mood } from '@prisma/client'
import Link from 'next/link'
import { TrendingDown, Minus, TrendingUp, Zap, X, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkInMood, dismissMoodCard } from '@/app/dashboard/actions'
import { MOOD_ORDER, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood-labels'
import { ACTION_TYPE_LINK } from '@/lib/weekly/action-effort'
import type { CommittedAction } from '@/lib/weekly/sprint'

const MOOD_ICON: Record<Mood, LucideIcon> = {
  STUCK: TrendingDown,
  GETTING_THERE: Minus,
  MOVING: TrendingUp,
  FIRED_UP: Zap,
}

export function MoodCheckInCard({
  todaysMood,
  currentStreak,
  checkInsLast7Days,
  isConsecutive,
  todaysIdeas,
  firstName,
  dismissedToday,
}: {
  todaysMood: Mood | null
  currentStreak: number
  checkInsLast7Days: number
  isConsecutive: boolean
  todaysIdeas: CommittedAction[]
  firstName: string | null
  // Server-computed: whether this was already dismissed today (see
  // moodCardDismissedAt / startOfUTCDay) — resets automatically tomorrow.
  dismissedToday: boolean
}) {
  const [optimisticMood, setOptimisticMood] = useState<Mood | null>(todaysMood)
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(dismissedToday)

  const mood = optimisticMood ?? todaysMood

  function handleCheckIn(selected: Mood) {
    setOptimisticMood(selected)
    startTransition(() => {
      checkInMood(selected)
    })
  }

  function handleDismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissMoodCard()
    })
  }

  const checkInSummary = isConsecutive
    ? `You've checked in ${currentStreak} day${currentStreak === 1 ? '' : 's'} in a row.`
    : `You've checked in ${checkInsLast7Days} out of the last 7 days.`

  if (dismissed) return null

  return (
    <Card aria-busy={isPending}>
      <CardHeader className="relative">
        <CardTitle className="text-base font-medium text-foreground">
          How motivated are you today{firstName ? `, ${firstName}` : ''}?
        </CardTitle>
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
          <div className="flex flex-wrap gap-3 sm:flex-nowrap">
            {MOOD_ORDER.map((option) => {
              const Icon = MOOD_ICON[option]
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleCheckIn(option)}
                  className="flex h-auto min-w-[45%] flex-1 flex-col items-center gap-1.5 rounded-md border border-input bg-white py-5 text-base transition-colors hover:border-brand disabled:cursor-wait sm:min-w-0"
                >
                  <Icon aria-hidden className="size-5 text-brand" />
                  {MOOD_LABEL[option]}
                </button>
              )
            })}
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
              {`${checkInSummary} Thanks for sharing, it helps us support you by knowing how you're doing. Keep it up!`}
            </p>
            {todaysIdeas.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Here&apos;s some ideas for you to do today:</p>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {todaysIdeas.map((idea, i) => {
                    const link = idea.actionType ? ACTION_TYPE_LINK[idea.actionType] : undefined
                    return (
                      <li key={i}>
                        {link ? (
                          <Link href={link.href} className="text-primary underline underline-offset-4">
                            {idea.text}
                          </Link>
                        ) : (
                          idea.text
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
