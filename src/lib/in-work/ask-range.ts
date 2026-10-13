// Ask-range calculator for raises, promotions and counter-offers.
//
// Pure arithmetic from numbers the member typed and, when it exists, the
// market range from our own data. It never invents a market number: with no
// market range it says so and works from the member's current pay alone.
// The percentages below are NextChapter rules of thumb for how wide to ask,
// stated in the rationale. They are not market statistics.

export type NegotiationSituation = 'RAISE' | 'PROMOTION' | 'COUNTER_OFFER'

export type AskRangeInput = {
  situation: NegotiationSituation
  currentBase: number // annual base, member entered
  marketLow?: number | null // from comp bands, when data exists
  marketHigh?: number | null
  competingOfferBase?: number | null // required for COUNTER_OFFER
}

export type MarketPosition = 'below' | 'within' | 'above' | 'unknown'

export type AskRange = {
  floor: number // lowest number worth saying yes to
  target: number // what you are aiming to land
  stretch: number // what you open with
  marketPosition: MarketPosition
  rationale: string[]
  cautions: string[]
}

export type AskRangeResult = { ok: true; range: AskRange } | { ok: false; error: string }

// Rules of thumb (percent over current base).
export const RAISE_STEPS = { floor: 0.04, target: 0.08, stretch: 0.12 } as const
export const PROMOTION_STEPS = { floor: 0.08, target: 0.12, stretch: 0.18 } as const
export const COUNTER_STEPS = { floor: 0, target: 0.03, stretch: 0.08 } as const // over the competing offer
export const ABOVE_MARKET_STEPS = { floor: 0.02, target: 0.04, stretch: 0.06 } as const
// A gap bigger than this share of current pay is closed in a step, then again
// at the next review, rather than all at once.
export const MAX_ONE_STEP_GAP = 0.2

export function roundToHundred(n: number): number {
  return Math.round(n / 100) * 100
}

// $500 steps under 200k keeps asks looking like numbers a person would say;
// $1,000 steps above that.
export function roundAsk(n: number): number {
  const step = n < 200_000 ? 500 : 1000
  return Math.round(n / step) * step
}

export function marketPositionFor(current: number, low: number | null | undefined, high: number | null | undefined): MarketPosition {
  if (!low || !high || high <= low) return 'unknown'
  if (current < low) return 'below'
  if (current > high) return 'above'
  return 'within'
}

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function computeAskRange(input: AskRangeInput): AskRangeResult {
  const { situation, currentBase } = input
  if (!Number.isFinite(currentBase) || currentBase <= 0) {
    return { ok: false, error: 'Enter your current annual base pay as a number above zero.' }
  }
  const rationale: string[] = []
  const cautions: string[] = []

  if (situation === 'COUNTER_OFFER') {
    const offer = input.competingOfferBase
    if (!offer || !Number.isFinite(offer) || offer <= 0) {
      return { ok: false, error: 'Enter the base pay of the competing offer.' }
    }
    const floor = roundAsk(offer * (1 + COUNTER_STEPS.floor))
    const target = roundAsk(offer * (1 + COUNTER_STEPS.target))
    const stretch = roundAsk(offer * (1 + COUNTER_STEPS.stretch))
    rationale.push(`The competing offer is ${formatUsd(offer)}, ${pctDiff(offer, currentBase)} ${offer >= currentBase ? 'above' : 'below'} your current base.`)
    rationale.push(`Floor is the offer itself: ${formatUsd(floor)}. Staying has real value to you, so matching it is the minimum you should accept.`)
    rationale.push(`Target is the offer plus ${pct(COUNTER_STEPS.target)}, and you open at the offer plus ${pct(COUNTER_STEPS.stretch)}. These widths are our rule of thumb, not market data.`)
    if (offer < currentBase) cautions.push('The offer is below your current base. Compare total pay, scope and growth before you use it as leverage.')
    cautions.push('Only use a competing offer you would actually take. Do not bluff.')
    return { ok: true, range: { floor, target, stretch, marketPosition: 'unknown', rationale, cautions } }
  }

  const steps = situation === 'PROMOTION' ? PROMOTION_STEPS : RAISE_STEPS
  const label = situation === 'PROMOTION' ? 'promotion' : 'raise'
  const hasMarket = !!(input.marketLow && input.marketHigh && input.marketHigh > input.marketLow)
  const position = marketPositionFor(currentBase, input.marketLow, input.marketHigh)

  let floor = currentBase * (1 + steps.floor)
  let target = currentBase * (1 + steps.target)
  let stretch = currentBase * (1 + steps.stretch)

  if (!hasMarket) {
    rationale.push(`No market range is available for your role in our data, so this range comes from your current base of ${formatUsd(currentBase)} only.`)
    rationale.push(
      `Floor is ${pct(steps.floor)} over current, target ${pct(steps.target)}, and you open at ${pct(steps.stretch)}. These widths are our rule of thumb for a ${label}, not market data.`,
    )
    cautions.push('Without a market range, back the number with your logged results, not with a claim about what the market pays.')
  } else {
    const low = input.marketLow as number
    const high = input.marketHigh as number
    const mid = (low + high) / 2
    if (position === 'below') {
      const gap = (low - currentBase) / currentBase
      rationale.push(`Your base is below the market range of ${formatUsd(low)} to ${formatUsd(high)}.`)
      if (gap <= MAX_ONE_STEP_GAP) {
        floor = Math.max(floor, currentBase * 1.05)
        target = low
        stretch = Math.max(mid, low)
        rationale.push(`Target is the bottom of the range, ${formatUsd(low)}. You open at the middle, ${formatUsd(stretch)}.`)
      } else {
        target = currentBase * (1 + MAX_ONE_STEP_GAP)
        floor = Math.min(floor, target)
        stretch = Math.max(low, target)
        rationale.push(
          `The gap to the bottom of the range is ${pct(gap)}, which is large. Target closes ${pct(MAX_ONE_STEP_GAP)} of it now, and you open at the bottom of the range. Plan to close the rest at the next review.`,
        )
        cautions.push('A gap this large can also mean the posted ranges are for a different level. Check the role match before you quote the range.')
      }
    } else if (position === 'within') {
      rationale.push(`Your base is inside the market range of ${formatUsd(low)} to ${formatUsd(high)}.`)
      target = Math.min(currentBase * (1 + steps.target), high)
      stretch = Math.min(Math.max(currentBase * (1 + steps.stretch), target), high)
      floor = Math.min(floor, target)
      rationale.push(`Target is ${pct(steps.target)} over current, held at the top of the range. You open at ${formatUsd(roundAsk(stretch))}.`)
      if (currentBase * (1 + steps.target) > high) {
        cautions.push('The range tops out near your current pay. Past the top of the range, ask for scope, title, bonus or equity as well as base.')
      }
    } else {
      floor = currentBase * (1 + ABOVE_MARKET_STEPS.floor)
      target = currentBase * (1 + ABOVE_MARKET_STEPS.target)
      stretch = currentBase * (1 + ABOVE_MARKET_STEPS.stretch)
      rationale.push(`Your base is above the top of the market range of ${formatUsd(low)} to ${formatUsd(high)}.`)
      rationale.push(`The market does not support a large base increase. Ask ${pct(ABOVE_MARKET_STEPS.floor)} to ${pct(ABOVE_MARKET_STEPS.stretch)}, and make the case on scope and results.`)
      cautions.push('Consider asking for a bigger title, scope, bonus, equity or time off instead of base.')
    }
  }

  const f = roundAsk(floor)
  const t = Math.max(roundAsk(target), f)
  const s = Math.max(roundAsk(stretch), t)
  return { ok: true, range: { floor: f, target: t, stretch: s, marketPosition: position, rationale, cautions } }
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function pctDiff(a: number, b: number): string {
  return `${Math.round((Math.abs(a - b) / b) * 100)}%`
}
