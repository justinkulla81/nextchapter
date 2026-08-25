import type { Metadata } from 'next'
import Link from 'next/link'
import { CrucibleWordmark } from '@/components/crucible/CrucibleWordmark'
import { CrucibleLeaderboardTrackSelect } from '@/components/crucible/CrucibleLeaderboardTrackSelect'
import { getCrucibleLeaderboard } from '@/lib/crucible/leaderboard'
import { CRUCIBLE_JOB_INTENT_LABEL, type CrucibleJobIntentKey } from '@/lib/crucible/variants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Leaderboard' },
}

const TRACKS = Object.keys(CRUCIBLE_JOB_INTENT_LABEL) as CrucibleJobIntentKey[]

function isJobIntent(value: string | undefined): value is CrucibleJobIntentKey {
  return !!value && TRACKS.includes(value as CrucibleJobIntentKey)
}

export default async function CrucibleLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>
}) {
  const { track: rawTrack } = await searchParams
  const track: CrucibleJobIntentKey = isJobIntent(rawTrack) ? rawTrack : 'TECH'
  const entries = await getCrucibleLeaderboard(track)

  return (
    <div className="flex flex-1 flex-col bg-off-white">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/noexperience">
            <CrucibleWordmark className="text-xl" />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">Leaderboard</h1>
          <p className="mt-3 text-muted-foreground">
            Everyone who takes the challenge is on here automatically — ranked by score, one board per
            track.
          </p>
          <div className="mt-6">
            <CrucibleLeaderboardTrackSelect value={track} />
          </div>
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-light-gray bg-white">
          {entries.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No completed attempts on the {CRUCIBLE_JOB_INTENT_LABEL[track]} track yet — be the first.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-light-gray text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.rank} className={cn('border-b border-light-gray last:border-0')}>
                    <td className="px-4 py-3 font-semibold tabular-nums text-navy">{entry.rank}</td>
                    <td className="px-4 py-3 text-foreground">{entry.displayName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.band ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-8 text-center">
          <Link href="/noexperience/test" className="text-sm font-semibold text-primary underline underline-offset-4">
            Take the challenge →
          </Link>
        </p>
      </div>
    </div>
  )
}
