import type { CandidateProfile } from '@prisma/client'
import { after } from 'next/server'
import { loadMarketSize } from '@/lib/market/market-size-server'
import { seniorMember } from '@/lib/coach/seniority'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { signalInputsFor } from '@/lib/personalization/know-you'
import { buildSignals, precisionOf } from '@/lib/personalization/signals'
import { nextMove, type NextMove } from '@/lib/market/next-move'
import { captureServerEvent } from '@/lib/posthog/server'
import { TrackedLink } from '@/components/dashboard/TrackedLink'

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * "Your next move" at the top of Find a job (owner, 2026-11-17): stay the course, consider a pivot, add a skill or finish
 * the profile, with the reason (next-move.ts). Replaces the market line and the "Better jobs for you" tune strip there.
 * Its own Suspense boundary: the job list never waits for it. Nothing when there is no basis for a recommendation.
 */
export async function NextMoveSection({ profile }: { profile: CandidateProfile }) {
  const [view, state] = await Promise.all([
    loadMarketSize(profile).catch(() => null),
    computeMatchState(profile, { live: true }).catch((error) => {
      console.error('Next move: match state unavailable:', error)
      return null
    }),
  ])
  const signals = state ? buildSignals(signalInputsFor(profile, state)) : null
  const tune = signals
    ? {
        pct: precisionOf(signals).pct,
        asks: signals
          .filter((s) => !s.known && s.weight > 0)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 2)
          .map((s) => ({ ask: `${s.label}.`, gain: `${cap(s.effect)}.` })),
      }
    : null
  const senior = seniorMember(profile)
  const move = nextMove({ market: view ? { open: view.counts.openNow, growth: view.growth, prompt: view.prompt, senior } : null, tune })
  if (!move) return null
  const track = { kind: move.kind, prompt: view?.prompt ?? null, open: view?.counts.openNow ?? null, tunePct: tune?.pct ?? null, senior }
  after(() => captureServerEvent(profile.id, 'next_move_shown', track))
  return <NextMoveCard move={move} track={track} />
}

/** The card's markup, shared with the dev preview so what is reviewed is what ships. */
export function NextMoveCard({ move, track }: { move: NextMove; track: Record<string, unknown> }) {
  return (
    <section aria-labelledby="next-move-heading" className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
      <div className="max-w-2xl space-y-1">
        <p id="next-move-heading" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Your next move: {move.label}
        </p>
        <p className="text-base font-medium text-ink">{move.text}</p>
        <p className="text-sm text-muted-foreground">{move.why}</p>
      </div>
      <TrackedLink
        href={move.action.href}
        event="next_move_clicked"
        properties={track}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {move.action.label}
      </TrackedLink>
    </section>
  )
}
