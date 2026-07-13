import type { Mood } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { checkInMood } from '@/app/dashboard/actions'
import { MOOD_ORDER, MOOD_EMOJI, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood'
import { frameActionForMood, type TodaysPrimaryAction } from '@/lib/daily/primary-action'

export function MoodCheckInCard({
  todaysMood,
  currentStreak,
  primaryAction,
}: {
  todaysMood: Mood | null
  currentStreak: number
  primaryAction: TodaysPrimaryAction | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          How are you feeling about the search today?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {MOOD_ORDER.map((mood) => (
            <form key={mood} action={checkInMood.bind(null, mood)}>
              <Button
                type="submit"
                variant={todaysMood === mood ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
              >
                <span aria-hidden>{MOOD_EMOJI[mood]}</span>
                {MOOD_LABEL[mood]}
              </Button>
            </form>
          ))}
        </div>

        {todaysMood && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm text-foreground">{MOOD_RESPONSE[todaysMood]}</p>
            {primaryAction && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Today&apos;s move: </span>
                {frameActionForMood(primaryAction.text, todaysMood)}
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
