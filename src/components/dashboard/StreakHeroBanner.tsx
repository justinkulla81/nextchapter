import { cn } from '@/lib/utils'

// Duolingo's exact pattern (Prompt 52): a big flame + streak number, plus a
// 7-day strip showing which of the last 7 days had activity. First thing
// visible on the redesigned Stats page.
export function StreakHeroBanner({
  currentStreak,
  activeDays,
}: {
  currentStreak: number
  activeDays: boolean[] // exactly 7, oldest to newest, today last
}) {
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString(undefined, { weekday: 'narrow' })
  })

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-gradient-to-b from-orange-50 to-white p-6 text-center">
      <div className="flex items-center gap-2">
        <span className="text-5xl" aria-hidden>
          🔥
        </span>
        <span className="text-4xl font-bold tabular-nums text-foreground">{currentStreak}</span>
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {currentStreak === 1 ? 'day streak' : 'day streak'}
      </p>
      <div className="flex gap-2">
        {activeDays.map((active, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-xs font-semibold',
                active ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
              )}
            >
              {active ? '🔥' : ''}
            </span>
            <span className="text-[10px] text-muted-foreground">{dayLabels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
