'use client'

import Link from 'next/link'
import { Check, Circle } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { AddCityPrompt } from '@/components/dashboard/AddCityPrompt'
import type { Precision, Signal } from '@/lib/personalization/signals'

/**
 * "What we know about you" on the board: the signals matching reads and what each changes,
 * the missing ones greyed with their counted payoff and a one-tap fix, the precision meter,
 * and the "your board got smarter" lines. Everything comes from the member's last match run.
 */
export function KnowYouCard({
  signals,
  precision,
  lines,
  states,
  cityFallback,
}: {
  signals: Signal[]
  precision: Precision
  lines: string[]
  /** For the inline city fix. */
  states: string[]
  cityFallback: string
}) {
  const track = (s: Pick<Signal, 'key' | 'known'>, where: string) => posthog.capture('profile_signal_clicked', { signal: s.key, known: s.known, where, precision: precision.pct })
  return (
    <section aria-labelledby="know-you-heading" className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
      {lines.length > 0 && (
        <ul className="space-y-0.5" aria-label="What changed on your board">
          {lines.map((l) => (
            <li key={l} className="text-foreground">
              {l}
            </li>
          ))}
        </ul>
      )}
      <details open={precision.pct < 100} className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
          <span id="know-you-heading" className="font-medium text-foreground">
            What we know about you
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            Your search is <span className="font-semibold text-foreground">{precision.pct}% tuned</span>
            <span role="meter" aria-label="How tuned your search is" aria-valuemin={0} aria-valuemax={100} aria-valuenow={precision.pct} className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
              <span className="block h-full rounded-full bg-success" style={{ width: `${precision.pct}%` }} />
            </span>
          </span>
        </summary>
        {precision.next && (
          <p className="mt-2 text-muted-foreground">
            Next:{' '}
            <Link href={precision.next.href} onClick={() => track({ key: precision.next!.key, known: false }, 'next_step')} className="font-medium text-primary underline underline-offset-4">
              {precision.next.label}
            </Link>{' '}
            — +{precision.next.gain}% · {precision.next.effect}
          </p>
        )}
        <ul className="mt-2 space-y-1">
          {signals.map((s) => (
            <li key={s.key} className={cn('flex items-start gap-2', !s.known && 'text-muted-foreground')}>
              {s.known ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Known" /> : <Circle className="mt-0.5 size-3.5 shrink-0" aria-label="Missing" />}
              <span className="min-w-0 flex-1">
                {s.key === 'city' && !s.known ? (
                  <AddCityPrompt surface="know_you" states={states} fallback={cityFallback} />
                ) : (
                  <>
                    <span className={cn(s.known && 'text-foreground')}>{s.label}</span> — {s.effect}{' '}
                    <Link href={s.href} onClick={() => track(s, 'line')} className="text-primary underline underline-offset-4">
                      {s.known ? 'Edit' : 'Add'}
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
