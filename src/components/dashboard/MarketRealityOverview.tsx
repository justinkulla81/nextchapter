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
import { CategorySparkline } from '@/components/dashboard/CategorySparkline'
import type { CategoryMover } from '@/lib/scoring/market-reality-history'
import { Card, CardContent } from '@/components/ui/card'
import { MarketRealitySnapshotArchive, type ArchivedSnapshot } from '@/components/dashboard/MarketRealitySnapshotArchive'
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
  categories,
  categoryHistory,
  whatMoved,
  archiveSnapshots,
}: {
  weekLabel: string
  currentGrade: Grade
  previousGrade: Grade | null
  bestWeekSentence: string | null
  categories: CategoryGrade[]
  categoryHistory: Map<CategoryGrade['key'], number[]>
  whatMoved: CategoryMover[]
  archiveSnapshots: ArchivedSnapshot[]
}) {
  const orderedCategories = CATEGORY_ORDER.map((key) => categories.find((c) => c.key === key)).filter(
    (c): c is CategoryGrade => c !== undefined
  )

  return (
    <Card>
      <CardContent>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground" title="How the market currently sees you">
              Market Reality
            </span>
            <span className={cn('w-6 shrink-0 text-center text-sm font-bold', GRADE_TEXT_COLOR[currentGrade])}>
              {currentGrade}
            </span>
            {previousGrade && previousGrade !== currentGrade && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap',
                  currentGrade < previousGrade ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                )}
              >
                {currentGrade < previousGrade ? '↑' : '↓'} from {previousGrade}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{bestWeekSentence ?? weekLabel}</p>
        </div>

        <div className="mt-4 space-y-1 border-t-2 border-border pt-4">
          <h4 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            The six component categories behind this grade
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
                      title={CONFIDENCE_EXPLANATION[c.confidence]}
                    >
                      {CONFIDENCE_LABEL[c.confidence]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_EXPLANATION[c.key]}
                    {c.confidence !== 'HIGH' && (
                      <>
                        {' '}
                        <Link href="/dashboard/references" className="text-primary underline underline-offset-4">
                          Invite references to sharpen this →
                        </Link>
                      </>
                    )}
                  </p>
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

        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <h4 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Market Reality Summaries, week by week
          </h4>
          <MarketRealitySnapshotArchive snapshots={archiveSnapshots} />
          <p className="text-xs text-muted-foreground">
            The full narrative behind any week&apos;s grade lives on your{' '}
            <Link href="/dashboard/hireability-report" className="text-primary underline underline-offset-4">
              Market Reality Report
            </Link>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
