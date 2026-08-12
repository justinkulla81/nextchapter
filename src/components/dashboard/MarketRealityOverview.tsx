import Link from 'next/link'
import {
  CATEGORY_ORDER,
  CATEGORY_EXPLANATION,
  CONFIDENCE_LABEL,
  CONFIDENCE_EXPLANATION,
  CONFIDENCE_STYLE,
  GRADE_TEXT_COLOR,
  type CategoryGrade,
  type Grade,
} from '@/lib/scoring/grade'
import { MarketRealityTrendChart, type TrendSnapshot } from '@/components/dashboard/MarketRealityTrendChart'
import { CategorySparkline } from '@/components/dashboard/CategorySparkline'
import type { CategoryMover } from '@/lib/scoring/market-reality-history'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Prompt 47/spec §9.3 — "a portfolio statement: position, movement, and
// what moved it." Never shows a raw numeric score or percentile anywhere
// (see grade.ts's GRADE_BAND_DESCRIPTION comment) — only letter grades,
// directional arrows, and sparkline shape.

const CATEGORY_MOVER_ARROW: Record<CategoryMover['direction'], string> = { up: '↑', down: '↓' }

export function MarketRealityOverview({
  weekLabel,
  currentGrade,
  previousGrade,
  bestWeekSentence,
  trendSnapshots,
  categories,
  categoryHistory,
  whatMoved,
  sprintCompletionStreak,
  longestSprintCompletionStreak,
  weeksOfImprovement,
}: {
  weekLabel: string
  currentGrade: Grade
  previousGrade: Grade | null
  bestWeekSentence: string | null
  trendSnapshots: TrendSnapshot[]
  categories: CategoryGrade[]
  categoryHistory: Map<CategoryGrade['key'], number[]>
  whatMoved: CategoryMover[]
  sprintCompletionStreak: number
  longestSprintCompletionStreak: number
  weeksOfImprovement: number
}) {
  const orderedCategories = CATEGORY_ORDER.map((key) => categories.find((c) => c.key === key)).filter(
    (c): c is CategoryGrade => c !== undefined
  )

  return (
    <Card>
      <CardContent>
        <div className="-mx-6 -mt-6 rounded-t-xl bg-brand/5 px-6 pt-6 pb-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
              title="How the market currently sees you"
            >
              Market Reality
            </h3>
            <span className="text-xs text-muted-foreground">{weekLabel}</span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn('text-5xl font-bold', GRADE_TEXT_COLOR[currentGrade])}>{currentGrade}</span>
            {previousGrade && previousGrade !== currentGrade && (
              <span className="text-sm text-muted-foreground">from {previousGrade}</span>
            )}
          </div>
          {bestWeekSentence && <p className="mt-1 text-sm text-foreground">{bestWeekSentence}</p>}

          <div className="mt-3">
            <MarketRealityTrendChart snapshots={trendSnapshots} />
          </div>
        </div>

        <div className="mt-6 space-y-1">
          <h4 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            The six categories behind this grade
          </h4>
          <div className="mt-2 space-y-1">
            {orderedCategories.map((c) => {
              const history = categoryHistory.get(c.key) ?? []
              return (
                <div key={c.key} className="space-y-0.5 border-b border-border py-1.5 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.label}</span>
                    <span className={cn('w-6 shrink-0 text-center text-sm font-semibold', GRADE_TEXT_COLOR[c.grade])}>
                      {c.grade}
                    </span>
                    <span className="shrink-0">
                      <CategorySparkline scores={history} />
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap',
                        CONFIDENCE_STYLE[c.confidence]
                      )}
                    >
                      {CONFIDENCE_LABEL[c.confidence]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{CATEGORY_EXPLANATION[c.key]}</p>
                </div>
              )
            })}
          </div>
        </div>

        {whatMoved.length > 0 && (
          <div className="mt-6 space-y-1.5 border-t border-border pt-4">
            <h4 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              What moved this week
            </h4>
            <ul className="space-y-1">
              {whatMoved.map((m) => (
                <li key={m.key} className="text-sm text-foreground">
                  <span className={m.direction === 'up' ? 'text-success' : 'text-error'}>
                    {CATEGORY_MOVER_ARROW[m.direction]}
                  </span>{' '}
                  <span className="font-medium">{m.label}</span> — {m.fromGrade} → {m.toGrade}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(() => {
          const unlockable = orderedCategories.filter((c) => c.confidence !== 'HIGH')
          if (unlockable.length === 0) return null
          return (
            <div className="mt-6 space-y-3 border-t border-border pt-4">
              {unlockable.map((c) => (
                <div key={c.key} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {c.label} — {CONFIDENCE_LABEL[c.confidence]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{CONFIDENCE_EXPLANATION[c.confidence]}</p>
                  <Link href="/dashboard/references" className="mt-1 inline-block text-xs text-primary underline underline-offset-4">
                    Invite references →
                  </Link>
                </div>
              ))}
            </div>
          )
        })()}

        {(sprintCompletionStreak > 0 || longestSprintCompletionStreak > 0 || weeksOfImprovement > 0) && (
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            {sprintCompletionStreak > 0 &&
              `${sprintCompletionStreak} week${sprintCompletionStreak === 1 ? '' : 's'} of Sprint Target hit in a row`}
            {sprintCompletionStreak > 0 && (longestSprintCompletionStreak > 0 || weeksOfImprovement > 0) && ' · '}
            {longestSprintCompletionStreak > 0 && `Longest streak: ${longestSprintCompletionStreak} weeks`}
            {longestSprintCompletionStreak > 0 && weeksOfImprovement > 0 && ' · '}
            {weeksOfImprovement > 0 && `${weeksOfImprovement} weeks of improvement`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
