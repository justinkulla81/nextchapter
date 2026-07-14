'use client'

import { useState } from 'react'
import type { Mood } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { checkInMood } from '@/app/dashboard/actions'
import { MOOD_ORDER, MOOD_EMOJI, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood-labels'
import { frameActionForMood, type TodaysPrimaryAction } from '@/lib/daily/primary-action'
import type { Quote } from '@/lib/constants/quotes'

export function MoodCheckInCard({
  quote,
  todaysMood,
  currentStreak,
  primaryAction,
  firstName,
}: {
  quote: Quote
  todaysMood: Mood | null
  currentStreak: number
  primaryAction: TodaysPrimaryAction | null
  firstName: string | null
}) {
  const [editing, setEditing] = useState(false)
  const showPicker = !todaysMood || editing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium text-foreground">
          How motivated are you today{firstName ? `, ${firstName}` : ''}?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showPicker && (
          <blockquote className="text-sm text-muted-foreground italic">
            &ldquo;{quote.text}&rdquo;
            <footer className="mt-1 text-xs not-italic text-muted-foreground/80">— {quote.author}</footer>
          </blockquote>
        )}
        {showPicker ? (
          <div className="grid grid-cols-2 gap-3">
            {MOOD_ORDER.map((mood) => (
              <form key={mood} action={checkInMood.bind(null, mood)}>
                <Button
                  type="submit"
                  variant={todaysMood === mood ? 'default' : 'outline'}
                  className="h-auto w-full flex-col gap-1.5 py-5 text-base"
                  onClick={() => setEditing(false)}
                >
                  <span aria-hidden className="text-2xl">
                    {MOOD_EMOJI[mood]}
                  </span>
                  {MOOD_LABEL[mood]}
                </Button>
              </form>
            ))}
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-foreground">
                <span aria-hidden className="mr-1">
                  {MOOD_EMOJI[todaysMood!]}
                </span>
                {MOOD_RESPONSE[todaysMood!]}
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="shrink-0 text-xs text-muted-foreground underline underline-offset-4"
              >
                Edit
              </button>
            </div>
            {primaryAction && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Today&apos;s move: </span>
                {frameActionForMood(primaryAction.text, todaysMood!)}
                {primaryAction.engineHint && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (moves your {primaryAction.engineHint})
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {currentStreak > 0 && (
          <p className="text-xs text-muted-foreground">
            🔥 {currentStreak} day{currentStreak === 1 ? '' : 's'} checked in in a row
          </p>
        )}
      </CardContent>
    </Card>
  )
}
