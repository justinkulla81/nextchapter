import type { DailyActivity } from '@/lib/stats/activity-heatmap'
import { cn } from '@/lib/utils'

const WEEKS_TO_SHOW = 26

function intensityClass(points: number): string {
  if (points <= 0) return 'bg-muted'
  if (points < 15) return 'bg-brand/20'
  if (points < 40) return 'bg-brand/45'
  if (points < 80) return 'bg-brand/70'
  return 'bg-brand'
}

// GitHub-contribution-style calendar grid (Prompt 52), shaded by points
// earned that day. Weeks as columns, Sun-Sat as rows, oldest to newest.
export function ActivityHeatmap({ activity }: { activity: DailyActivity[] }) {
  const pointsByDate = new Map(activity.map((a) => [a.date, a.points]))

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const totalDays = WEEKS_TO_SHOW * 7
  // Start on a Sunday so rows line up Sun-Sat.
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - totalDays + 1 - start.getUTCDay())

  const weeks: { date: string; points: number }[][] = []
  const cursor = new Date(start)
  for (let w = 0; w < WEEKS_TO_SHOW + 1; w++) {
    const week: { date: string; points: number }[] = []
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10)
      week.push({ date: iso, points: pointsByDate.get(iso) ?? 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push(week)
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                className={cn('size-3 rounded-sm', intensityClass(day.points))}
                title={`${day.date}: ${day.points} pt${day.points === 1 ? '' : 's'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
