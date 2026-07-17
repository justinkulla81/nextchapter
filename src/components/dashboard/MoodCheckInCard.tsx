'use client'

import { useState, useTransition } from 'react'
import type { Mood } from '@prisma/client'
import { TrendingDown, Minus, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkInMood } from '@/app/dashboard/actions'
import { MOOD_ORDER, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood-labels'
import { frameActionForMood, type TodaysPrimaryAction } from '@/lib/daily/primary-action'

const MOOD_ICON: Record<Mood, LucideIcon> = {
  STUCK: TrendingDown,
  GETTING_THERE: Minus,
  MOVING: TrendingUp,
  FIRED_UP: Zap,
}

export function MoodCheckInCard({
  todaysMood,
  currentStreak,
  primaryAction,
  firstName,
}: {
  todaysMood: Mood | null
  currentStreak: number
  primaryAction: TodaysPrimaryAction | null
  firstName: string | null
}) {
  const [optimisticMood, setOptimisticMood] = useState<Mood | null>(todaysMood)
  const [optimisticStreak, setOptimisticStreak] = useState(currentStreak)
  const [isPending, startTransition] = useTransition()

  const mood = optimisticMood ?? todaysMood

  function handleCheckIn(selected: Mood) {
    setOptimisticMood(selected)
    if (!todaysMood) setOptimisticStreak((s) => s + 1)
    startTransition(() => {
      checkInMood(selected)
    })
  }

  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <CardTitle className="text-base font-medium text-foreground">
          How motivated are you today{firstName ? `, ${firstName}` : ''}?
        </CardTitle>
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
            {primaryAction && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Today&apos;s move: </span>
                {frameActionForMood(primaryAction.text, mood)}
                {primaryAction.engineHint && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (moves your {primaryAction.engineHint})
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {optimisticStreak > 0 && (
          <p className="text-xs text-muted-foreground">
            🔥 {optimisticStreak} day{optimisticStreak === 1 ? '' : 's'} checked in in a row
          </p>
        )}
      </CardContent>
    </Card>
  )
}
