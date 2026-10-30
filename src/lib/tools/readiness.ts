// The "if your job ended tomorrow" check for someone who still has one: how long the money lasts, roughly what unemployment
// would pay, what ends with the job (health, life, disability) and the dates that follow, and the few things worth doing now.
// Pure and tested in src/test/job-loss-readiness.test.ts. It composes the runway and benefit-estimate helpers the layoff tools
// already use, so the figures match those tools. Nothing here is a prediction that a layoff will happen.

import { COBRA, MARKETPLACE } from '@/lib/cobra-aca/rules'
import { calculateRunway } from '@/lib/tools/runway'
import { estimateUi, type UiEstimate } from '@/lib/tools/ui-estimate'

export type Cover = 'health' | 'life' | 'disability'

/** Group life plans commonly allow conversion or portability for 31 days after coverage ends. The plan and state law set the real number. */
export const LIFE_CONVERSION_DAYS = 31

export interface ReadinessInput {
  annualPay: number
  savings: number
  monthlyExpenses: number
  /** Severance the person expects after tax, 0 when none. */
  severance: number
  state: { maxWeekly: number | null; minWeekly: number | null; maxWeeks: number | null } | null
  /** Which of these they get through their employer today. */
  throughWork: Record<Cover, boolean>
}

export type RunwayBand = 'thin' | 'workable' | 'strong'

export interface CoverRow {
  cover: Cover
  title: string
  /** What happens to it when the job ends. */
  ends: string
  /** What to do about it, with the window when there is one. */
  next: string
  /** Days after the last day of work when the window closes, or null when there is no window. */
  windowDays: number | null
}

export interface ReadinessAction {
  id: string
  title: string
  body: string
  href?: string
  label?: string
}

export interface ReadinessResult {
  ui: UiEstimate | null
  monthsWithoutBenefits: number
  monthsWithBenefits: number
  band: RunwayBand
  /** Dollars short of six months of spending, 0 when there is already six months. */
  gapToSixMonths: number
  cover: CoverRow[]
  actions: ReadinessAction[]
}

/** Under three months is thin, three to six workable, over six strong. A search for a senior role often takes longer than six. */
export function bandFor(months: number): RunwayBand {
  return months < 3 ? 'thin' : months <= 6 ? 'workable' : 'strong'
}

const COVER_ROWS: Record<Cover, CoverRow> = {
  health: {
    cover: 'health',
    title: 'Health insurance',
    ends: 'Job-based health coverage usually ends on your last day or at the end of that month, depending on your plan.',
    next: `You have ${COBRA.electionDays} days to choose COBRA, counted from the later of your coverage ending and your notice, and ${MARKETPLACE.specialEnrollmentDays} days to join a Marketplace plan. Ask HR now for the full monthly COBRA price so you can compare before you need it.`,
    windowDays: MARKETPLACE.specialEnrollmentDays,
  },
  life: {
    cover: 'life',
    title: 'Life insurance',
    ends: 'Group life insurance through work generally ends with the job.',
    next: `Many plans let you convert it to your own policy or take it with you, often within ${LIFE_CONVERSION_DAYS} days. The window and the price are in your plan certificate, so read it now rather than in week four.`,
    windowDays: LIFE_CONVERSION_DAYS,
  },
  disability: {
    cover: 'disability',
    title: 'Disability insurance',
    ends: 'Group short- and long-term disability cover ends with the job, and most plans cannot be converted.',
    next: 'Your own disability policy is underwritten on your health and work today, so it is much harder to start once you are out of work. Find out what your plan pays, and whether it can be taken with you.',
    windowDays: null,
  },
}

/** The cover the person has through work, in the order that matters most when a job ends. */
export function coverRows(throughWork: Record<Cover, boolean>): CoverRow[] {
  return (['health', 'life', 'disability'] as Cover[]).filter((c) => throughWork[c]).map((c) => COVER_ROWS[c])
}

/** The date a window closes, counted from the last day of work (the cautious way to plan). */
export function windowDate(lastDay: Date, days: number): Date {
  return new Date(lastDay.getTime() + days * 86_400_000)
}

export function buildReadiness(i: ReadinessInput): ReadinessResult {
  const ui = i.state ? estimateUi({ annualPay: i.annualPay, maxWeekly: i.state.maxWeekly, minWeekly: i.state.minWeekly, maxWeeks: i.state.maxWeeks }) : null
  const run = calculateRunway({
    savings: i.savings,
    monthlyExpenses: i.monthlyExpenses,
    severance: i.severance,
    weeklyBenefit: ui?.weekly ?? 0,
    benefitWeeks: ui?.weeks ?? 0,
  })
  const pool = Math.max(0, i.savings) + Math.max(0, i.severance)
  const gapToSixMonths = Math.max(0, Math.round(6 * i.monthlyExpenses - pool))
  // The band is set by savings and severance alone: unemployment is an estimate and not guaranteed, so it cannot make a thin cushion look safe.
  const band = bandFor(run.monthsWithoutBenefits)

  const cover = coverRows(i.throughWork)
  const actions: ReadinessAction[] = []

  if (band === 'thin') {
    actions.push({
      id: 'cushion',
      title: gapToSixMonths > 0 ? `Build toward six months of spending (about $${gapToSixMonths.toLocaleString('en-US')} more)` : 'Build your cushion',
      body: 'Every month of runway you add now is a month you can spend choosing the right job instead of the first one. Start with a fixed amount each payday.',
    })
  }
  if (i.throughWork.health) {
    actions.push({
      id: 'cobra',
      title: 'Know what your coverage would cost on your own',
      body: 'Ask HR for the full monthly COBRA price, then see how a Marketplace plan compares at your household income.',
      href: '/tools/cobra-vs-aca-calculator',
      label: 'COBRA vs ACA calculator',
    })
  }
  if (i.throughWork.life || i.throughWork.disability) {
    actions.push({
      id: 'certificates',
      title: 'Read your life and disability certificates',
      body: 'Find the conversion or portability terms and their deadline. They are in the benefits summary or on your benefits site.',
    })
  }
  actions.push({
    id: 'resume',
    title: 'Keep your résumé current',
    body: 'Updating it while you are employed takes an evening. Doing it after a notice takes a week you would rather spend talking to people.',
    href: '/tools/resume-check',
    label: 'Résumé check',
  })
  actions.push({
    id: 'warning-signs',
    title: 'Check the warning signs at your company',
    body: 'Public layoff records and filings show patterns. This is not a prediction, only the facts that are on file.',
    href: '/tools/layoff-risk-check',
    label: 'Layoff risk check',
  })

  return { ui, monthsWithoutBenefits: run.monthsWithoutBenefits, monthsWithBenefits: run.monthsWithBenefits, band, gapToSixMonths, cover, actions }
}
