import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { BoardResult } from '@/lib/leaderboard/queries'

// PART FOUR §19 — "Community page gets a condensed top-3-of-Action-Score
// module linking to Stats." Deliberately minimal: no filters, no other
// boards, no own-position framing here — that's all on the Stats page. This
// is a teaser, not a second leaderboard surface.
export function CommunityLeaderboardModule({ result }: { result: BoardResult }) {
  if (result.top10.length === 0) return null

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Trophy className="size-4 text-brand" aria-hidden />
          This week&apos;s Action Score
        </p>
        <Link href="/dashboard/stats#leaderboards" className="text-xs font-medium text-primary underline underline-offset-4">
          See all leaderboards
        </Link>
      </div>
      <ol className="mt-2 space-y-1">
        {result.top10.slice(0, 3).map((entry) => (
          <li key={entry.candidateId} className="flex items-center justify-between gap-2 text-sm text-foreground">
            <span className="flex items-center gap-2">
              <span className="w-4 text-right tabular-nums text-muted-foreground">{entry.rank}</span>
              <span className="truncate">{entry.displayName ?? 'A member'}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{entry.value} pts</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
