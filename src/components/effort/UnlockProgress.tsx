import Link from 'next/link'
import { KIND_LABEL, POINT_VALUES, type EffortKind, type UnlockStatus } from '@/lib/effort/points'
import { UnlockButton, type UnlockActionState } from './UnlockButton'

const KIND_ORDER: EffortKind[] = ['login', 'networking', 'partnerJob', 'application', 'learning', 'reference', 'question']

const KIND_HREF: Record<EffortKind, string> = {
  login: '/dashboard',
  networking: '/dashboard/network',
  partnerJob: '/dashboard/find-my-job',
  application: '/dashboard/find-my-job',
  learning: '/dashboard/learning',
  reference: '/dashboard/references',
  question: '/dashboard/search-strategy',
}

/**
 * "Unlock your next strategy (or report)": how many effort points the member has earned since the
 * last one, where they came from, what still stands in the way, and the quickest ways to earn the rest.
 * Plain ink on white, no streak or score to chase: one bar, one number, one button when it is earned.
 */
export function UnlockProgress({
  status,
  title,
  what,
  action,
  buttonLabel,
  pendingLabel,
  event,
}: {
  status: UnlockStatus
  title: string
  what: string
  action: (prev: UnlockActionState, formData: FormData) => Promise<UnlockActionState>
  buttonLabel: string
  pendingLabel: string
  event: string
}) {
  const { score, bar } = status
  const pct = Math.min(100, Math.round((score.total / bar.points) * 100))
  return (
    <section aria-labelledby={`unlock-${status.kind}`} className="space-y-4 rounded-lg border border-navy/20 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`unlock-${status.kind}`} className="font-serif text-lg font-semibold tracking-tight text-navy">
          {title}
        </h2>
        <p className="text-sm tabular-nums text-foreground">
          <span className="font-semibold">{Math.min(score.total, bar.points)}</span> of {bar.points} points
        </p>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">{what}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={bar.points} aria-valuenow={Math.min(score.total, bar.points)} aria-label={`${title}: ${score.total} of ${bar.points} points`} className="h-2 w-full rounded-full bg-muted">
        <div className="h-2 rounded-full bg-navy" style={{ width: `${pct}%` }} />
      </div>

      {status.unlocked ? (
        <div className="space-y-2">
          <p className="text-sm text-foreground">You have earned it. It will be written from everything you have done since the last one.</p>
          <UnlockButton action={action} label={buttonLabel} pendingLabel={pendingLabel} event={event} />
        </div>
      ) : (
        <p className="text-sm text-foreground">
          <span className="font-semibold">To unlock:</span> {status.blockers.join('; ')}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-sm" aria-label="Where your points came from">
          <thead>
            <tr className="border-b border-navy text-left text-xs font-semibold tracking-wide text-navy uppercase">
              <th scope="col" className="py-1.5 pr-3">Activity</th>
              <th scope="col" className="py-1.5 pr-3">Each</th>
              <th scope="col" className="py-1.5 pr-3">Counted</th>
              <th scope="col" className="py-1.5 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {KIND_ORDER.map((k) => {
              const row = score.byKind.find((x) => x.kind === k)
              const label = KIND_LABEL[k]
              return (
                <tr key={k} className="border-b border-border">
                  <td className="py-1.5 pr-3 text-foreground">
                    <Link href={KIND_HREF[k]} className="underline-offset-4 hover:underline">
                      {label.verb}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{POINT_VALUES[k]}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                    {row?.counted ?? 0}
                    {row && row.done > row.counted ? ` of ${row.done}` : ''}
                  </td>
                  <td className="py-1.5 text-right font-medium tabular-nums text-foreground">{row?.points ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!status.unlocked && status.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Fastest ways to earn more</p>
          <ul className="mt-2 space-y-1 text-sm">
            {status.suggestions.map((s) => (
              <li key={s.kind}>
                <Link href={KIND_HREF[s.kind]} className="text-primary underline underline-offset-4">
                  {s.verb}
                </Link>{' '}
                <span className="text-muted-foreground">+{s.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Weekly limits keep any one activity from carrying the bar, and the next one needs at least {bar.minKinds} kinds of real work besides logging in and {bar.minDays} days since the last, so it rests on fresh evidence.
      </p>
    </section>
  )
}
