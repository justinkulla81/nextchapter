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
 * "Unlock your next strategy": how many strategy credits the member has earned since the
 * last one, where they came from, what still stands in the way, and the quickest ways to earn the rest.
 * The one navy block on the page. No streak or score to chase: one bar, one number, one button when it is earned.
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
  const shown = Math.min(score.total, bar.points)
  const pct = Math.min(100, Math.round((score.total / bar.points) * 100))
  return (
    <section id="unlock" aria-labelledby="unlock-title" className="space-y-4 rounded-2xl bg-navy p-6 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="unlock-title" className="font-serif text-xl font-semibold">
          {title}
        </h2>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{shown}</span> of {bar.points} strategy credits
        </p>
      </div>
      <p className="max-w-2xl text-base text-white/90">{what}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={bar.points} aria-valuenow={shown} aria-label={`${title}: ${shown} of ${bar.points} strategy credits`} className="h-2 w-full rounded-full bg-white/20">
        <div className="h-2 rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>

      {status.unlocked ? (
        <div className="space-y-2">
          <p className="text-sm">You have earned it. It will be written from everything you have done since the last one.</p>
          <UnlockButton action={action} label={buttonLabel} pendingLabel={pendingLabel} event={event} />
        </div>
      ) : (
        <p className="text-sm">
          <span className="font-semibold">To unlock:</span> {status.blockers.join('; ')}.
          {status.suggestions.length > 0 && (
            <>
              {' '}Fastest:{' '}
              {status.suggestions.map((s, i) => (
                <span key={s.kind}>
                  {i > 0 ? ', ' : ''}
                  <Link href={KIND_HREF[s.kind]} className="underline underline-offset-4">
                    {s.verb.toLowerCase()}
                  </Link>{' '}
                  (+{s.points})
                </span>
              ))}
              .
            </>
          )}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium underline underline-offset-4">How strategy credits are earned</summary>
        <div className="mt-3 overflow-x-auto text-white">
          <table className="w-full min-w-[26rem] border-collapse text-sm" aria-label="Where your strategy credits came from">
            <thead>
              <tr className="border-b border-white/40 text-left text-xs font-semibold tracking-wide uppercase">
                <th scope="col" className="py-1.5 pr-3">Activity</th>
                <th scope="col" className="py-1.5 pr-3">Each</th>
                <th scope="col" className="py-1.5 pr-3">Counted</th>
                <th scope="col" className="py-1.5 text-right">Credits</th>
              </tr>
            </thead>
            <tbody>
              {KIND_ORDER.map((k) => {
                const row = score.byKind.find((x) => x.kind === k)
                return (
                  <tr key={k} className="border-b border-white/20">
                    <td className="py-1.5 pr-3">
                      <Link href={KIND_HREF[k]} className="underline-offset-4 hover:underline">
                        {KIND_LABEL[k].verb}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-white/80">{POINT_VALUES[k]}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-white/80">
                      {row?.counted ?? 0}
                      {row && row.done > row.counted ? ` of ${row.done}` : ''}
                    </td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{row?.points ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-white/80">
            Weekly limits keep any one activity from carrying the bar, and the next one needs at least {bar.minKinds} kinds of real work besides logging in and {bar.minDays} days since the last, so it rests on fresh evidence.
          </p>
        </div>
      </details>
    </section>
  )
}
