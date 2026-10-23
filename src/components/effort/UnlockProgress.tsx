import Link from 'next/link'
import { CheckCircle2, TrendingUp } from 'lucide-react'
import type { UnlockStatus } from '@/lib/effort/unlock'
import { unlockProgressText } from '@/lib/effort/unlock-text'
import { UnlockButton, type UnlockActionState } from './UnlockButton'

/**
 * Progress toward the next strategy: how far along the member is, what counts, why there is a wait,
 * and the one button when it is ready. The same minutes grade the week and earn Candidate+, so there
 * is one measure of activity, not two. The one navy block on the page. Wording: src/lib/effort/unlock-text.ts.
 */
export function UnlockProgress({
  status,
  what,
  action,
  buttonLabel,
  pendingLabel,
  event,
}: {
  status: UnlockStatus
  what: string
  action: (prev: UnlockActionState, formData: FormData) => Promise<UnlockActionState>
  buttonLabel: string
  pendingLabel: string
  event: string
}) {
  const { bar, minutes } = status
  const shown = Math.min(minutes, bar.minutes)
  const text = unlockProgressText(status)
  const Icon = status.unlocked ? CheckCircle2 : TrendingUp
  return (
    <section id="unlock" aria-labelledby="unlock-title" className="space-y-4 rounded-2xl bg-navy p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="unlock-title" className="flex items-center gap-2.5 font-serif text-xl font-semibold">
          <Icon className="size-5 shrink-0" aria-hidden />
          <span>{text.headline}</span>
        </h2>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{shown}</span> of {bar.minutes} points of search work
        </p>
      </div>
      <p className="max-w-2xl text-base text-white/90">{what}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={text.pct} aria-label={text.headline} className="h-2 w-full rounded-full bg-white/20">
        <div className="h-2 rounded-full bg-white" style={{ width: `${text.pct}%` }} />
      </div>

      {status.unlocked ? (
        <div className="space-y-2">
          <p className="text-sm">{text.detail}</p>
          <UnlockButton action={action} label={buttonLabel} pendingLabel={pendingLabel} event={event} />
        </div>
      ) : (
        <p className="text-sm">
          {text.detail}{' '}
          <Link href="/dashboard/sprint" className="underline underline-offset-4">
            Open this week&apos;s plan
          </Link>{' '}
          to add minutes. They are the same minutes that grade your week and earn Candidate+.
        </p>
      )}
    </section>
  )
}
