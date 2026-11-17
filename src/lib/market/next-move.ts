// "Your next move" at the top of Find a job (owner, 2026-11-17): one recommendation with its reason, chosen from the
// member's market (market-size.ts / market-line.ts) and how well their profile is tuned (match-precision). It answers
// "should I pivot, or am I in a good pool? learn a skill? finish my profile?" with one answer, not four boxes.
// Pure: src/test/next-move.test.ts.

import { marketLine, type MarketLineInput } from './market-line'

export type NextMoveKind = 'stay' | 'network' | 'pivot' | 'learn' | 'narrow' | 'profile'

export interface NextMove {
  kind: NextMoveKind
  /** The card's kicker, after "Your next move:". */
  label: string
  text: string
  why: string
  action: { label: string; href: string }
}

export interface NextMoveInput {
  market: MarketLineInput | null
  /** How tuned the member's matching is (0-100) and the asks that would tune it most, best first. */
  tune: { pct: number; asks: { ask: string; gain: string }[] } | null
}

/** Below this, finishing the profile comes before staying the course or narrowing (it changes which jobs are shown). */
export const TUNE_FIRST_BELOW = 70

const LABEL: Record<NextMoveKind, string> = {
  stay: 'Stay the course',
  network: 'Work your network',
  pivot: 'Consider a pivot',
  learn: 'Add a skill',
  narrow: 'Narrow your focus',
  profile: 'Finish your profile',
}

/** "We'd check" -> "we'd check" after a colon; an acronym ("AI") is left alone. */
const lowerFirst = (t: string) => (/^[A-Z][a-z']/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t)

function profileMove(tune: NonNullable<NextMoveInput['tune']>): NextMove {
  return {
    kind: 'profile',
    label: LABEL.profile,
    text: `Your matches are ${tune.pct}% tuned.`,
    why: tune.asks.map((a) => `${a.ask.replace(/\.$/, '')}: ${lowerFirst(a.gain)}`).join(' ') || 'A couple of answers would sharpen which jobs you see.',
    action: { label: 'Improve my matches', href: '/dashboard/improve' },
  }
}

export function nextMove(i: NextMoveInput): NextMove | null {
  const tuneFirst = i.tune && i.tune.pct < TUNE_FIRST_BELOW && i.tune.asks.length > 0 ? i.tune : null
  if (!i.market) return tuneFirst ? profileMove(tuneFirst) : null

  const line = marketLine(i.market)
  const step = { label: line.step.label, href: line.step.href }
  switch (line.step.kind) {
    // Too few roles for a mid-level search: the field itself is the problem.
    case 'expand':
      return { kind: 'pivot', label: LABEL.pivot, text: line.text, why: line.why, action: { label: 'See where to widen', href: step.href } }
    case 'learn':
      return { kind: 'learn', label: LABEL.learn, text: line.text, why: line.why, action: step }
    case 'narrow':
      return tuneFirst ? profileMove(tuneFirst) : { kind: 'narrow', label: LABEL.narrow, text: line.text, why: line.why, action: step }
    case 'network':
      if (tuneFirst) return profileMove(tuneFirst)
      // Few roles at a senior level is normal, not a reason to pivot: say so.
      if (i.market.prompt === 'too_few') return { kind: 'network', label: LABEL.network, text: line.text, why: line.why, action: step }
      return { kind: 'stay', label: LABEL.stay, text: `You're in a good pool. ${line.text}`, why: line.why, action: step }
  }
}
