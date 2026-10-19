import Link from 'next/link'
import { Lock, LockOpen } from 'lucide-react'
import type { UnlockStatus } from '@/lib/effort/unlock'
import { UnlockButton, type UnlockActionState } from './UnlockButton'

/**
 * "Unlock your next strategy": how many minutes of search effort the member has put in since the last
 * one, what still stands in the way, and the one button when it is earned. The same minutes grade the
 * week and earn Candidate+, so there is one measure of activity, not two. The one navy block on the page.
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
  const { bar, minutes } = status
  const shown = Math.min(minutes, bar.minutes)
  const pct = Math.min(100, Math.round((minutes / bar.minutes) * 100))
  const Icon = status.unlocked ? LockOpen : Lock
  return (
    <section id="unlock" aria-labelledby="unlock-title" className="space-y-4 rounded-2xl bg-navy p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="unlock-title" className="flex items-center gap-2.5 font-serif text-xl font-semibold">
          <Icon className="size-5 shrink-0" aria-hidden />
          <span>
            {title}
            <span className="sr-only">{status.unlocked ? ' (unlocked)' : ' (locked)'}</span>
          </span>
        </h2>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{shown}</span> of {bar.minutes} minutes of search effort
        </p>
      </div>
      <p className="max-w-2xl text-base text-white/90">{what}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={bar.minutes} aria-valuenow={shown} aria-label={`${title}: ${shown} of ${bar.minutes} minutes of search effort`} className="h-2 w-full rounded-full bg-white/20">
        <div className="h-2 rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>

      {status.unlocked ? (
        <div className="space-y-2">
          <p className="text-sm">You have earned it. It will be written from everything you have done since the last one.</p>
          <UnlockButton action={action} label={buttonLabel} pendingLabel={pendingLabel} event={event} />
        </div>
      ) : (
        <p className="text-sm">
          <span className="font-semibold">To unlock:</span> {status.blockers.join('; ')}.{' '}
          <Link href="/dashboard/sprint" className="underline underline-offset-4">
            Open this week&apos;s plan
          </Link>{' '}
          to earn the minutes. One point is one minute, the same minutes that grade your week and earn Candidate+.
        </p>
      )}
    </section>
  )
}
