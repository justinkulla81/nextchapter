import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardBoard } from '@prisma/client'
import type { BoardResult } from '@/lib/leaderboard/queries'
import { LEADERBOARD_BOARD_LABEL, LEADERBOARD_BOARD_DESCRIPTION, LEADERBOARD_BOARD_UNIT } from '@/lib/leaderboard/boards'
import { describeOwnPosition, formatOwnPosition } from '@/lib/leaderboard/wellbeing'

// PART FOUR §14/§18/§19 — one board's card on the Stats page. Pure display:
// all ranking/anti-gaming/privacy logic already happened in queries.ts by
// the time this renders. §18 wellbeing rules enforced here, not just
// documented — describeOwnPosition/formatOwnPosition are the only path this
// component uses to talk about the viewer's own standing, so there is no
// code path in this file that can print a raw low rank.
export function LeaderboardBoardCard({
  board,
  result,
  personalBest,
}: {
  board: LeaderboardBoard
  result: BoardResult
  personalBest: { bestValue: number; weekStartDate: Date } | null
}) {
  const unit = LEADERBOARD_BOARD_UNIT[board]
  const tenthPlaceValue = result.top10.length >= 10 ? result.top10[9].value : null
  const ownMessage = describeOwnPosition({ own: result.own, tenthPlaceValue })

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{LEADERBOARD_BOARD_LABEL[board]}</p>
          <p className="text-xs text-muted-foreground">{LEADERBOARD_BOARD_DESCRIPTION[board]}</p>
        </div>
        {result.weekStartDate && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Week of {result.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {result.top10.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Not enough opted-in members yet in this view.</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {result.top10.map((entry) => (
            <li
              key={entry.candidateId}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm',
                result.own?.optedIn && result.own.rank === entry.rank ? 'bg-brand/10 font-medium text-foreground' : 'text-foreground'
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{entry.rank}</span>
                <span className="truncate">{entry.displayName ?? 'A member'}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{entry.value}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-xs font-medium text-foreground">{formatOwnPosition(ownMessage, unit)}</p>

      {personalBest && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Trophy className="size-3 shrink-0" aria-hidden />
          Your best week yet — {personalBest.bestValue} {unit} (week of{' '}
          {personalBest.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})
        </p>
      )}
    </div>
  )
}
