import Link from 'next/link'
import { HomeModule } from './HomeModule'
import { nextRung, type Rung } from '@/lib/unlocks/ladder'

// Where the member stands on the single unlock ladder, and the one next
// thing. Everyone has a dossier from day one; it is "still building" until
// Candidate+ marks it complete.
export function UnlocksModule({
  ladder,
  evidenceAreas,
  evidenceTotal,
  confidential = false,
}: {
  ladder: Rung[]
  evidenceAreas: number
  evidenceTotal: number
  confidential?: boolean
}) {
  const next = nextRung(ladder)
  const openCount = ladder.filter((r) => r.state === 'open').length
  return (
    <HomeModule title="Unlocks" tone="dark">
      <div>
        <p className="text-sm font-semibold">Your dossier is building</p>
        <p className="mt-1 text-sm text-white/80">
          {evidenceAreas} of {evidenceTotal} areas have evidence so far. Everyone has one from day one. Finish it to become Candidate+.
        </p>
      </div>
      {next ? (
        <div className="space-y-2 rounded-lg bg-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Next unlock: {next.label}</p>
            <p className="text-xs text-white/80">
              {openCount} of {ladder.length} open
            </p>
          </div>
          <ol className="flex gap-1.5" aria-label="Unlock progress">
            {ladder.map((r) => (
              <li
                key={r.key}
                className={r.state === 'open' ? 'h-1.5 flex-1 rounded-full bg-white' : r.state === 'next' ? 'h-1.5 flex-1 rounded-full bg-orange' : 'h-1.5 flex-1 rounded-full bg-white/25'}
              >
                <span className="sr-only">
                  {r.label}: {r.state === 'open' ? 'open' : r.state === 'next' ? 'next' : 'locked'}
                </span>
              </li>
            ))}
          </ol>
          {next.needs.length > 0 && <p className="text-sm text-white/90">You need {joinPlain(next.needs)}.</p>}
          <p className="text-sm text-white/80">Opens: {next.opens.join(', ')}.</p>
        </div>
      ) : (
        <p className="rounded-lg bg-white/10 p-4 text-sm font-semibold">Every unlock is open.</p>
      )}
      {confidential && (
        <p className="text-sm text-white/80">
          Confidential mode is on, so recruiters and hiring managers cannot see your Candidate+ mark until you choose to show it.
        </p>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/dashboard/stats" className="font-medium underline underline-offset-4">
          See my progress
        </Link>
        <Link href="/dashboard/recruiter-report" className="font-medium underline underline-offset-4">
          Strengthen what recruiters see
        </Link>
      </div>
    </HomeModule>
  )
}

function joinPlain(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
