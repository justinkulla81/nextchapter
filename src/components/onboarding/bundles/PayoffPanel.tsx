import { Chip } from '@/components/candidate/ui'
import type { Payoff } from '@/lib/onboarding/payoff'

// What the member gets for answering. It sits under the questions and changes as they answer, so the
// reason for each question is visible while they are still on it. `busy` marks a count being worked out.
export function PayoffPanel({ payoff, busy = false, label = 'What you get' }: { payoff: Payoff; busy?: boolean; label?: string }) {
  return (
    <section aria-label={label} aria-live="polite" aria-busy={busy} className="space-y-3 rounded-2xl bg-muted/60 p-5">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-2xl leading-snug font-semibold text-ink">{busy ? 'Counting the jobs that fit…' : payoff.headline}</p>
      {payoff.lines.length > 0 && (
        <ul className="space-y-1.5 text-base text-ink">
          {payoff.lines.map((line, i) => (
            <li key={line} className="flex gap-3">
              {payoff.kind === 'plan' ? <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-ink">{i + 1}</span> : null}
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
      {payoff.chips.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Changes
          {payoff.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </p>
      )}
    </section>
  )
}
