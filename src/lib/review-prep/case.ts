// Build your case: the facts a review, a raise or a promotion conversation
// rests on, pulled from what the member has already recorded (Track Record,
// work samples, approved reference quotes, learning) and what is still
// missing. Pure; the page loads the data and renders this.

import type {
  TrackRecordBoardExposure,
  TrackRecordDollarBand,
  TrackRecordGeographicScope,
  TrackRecordPnlAccountability,
  TrackRecordReportedToLevel,
  TrackRecordSizeBand,
} from '@prisma/client'
import {
  TRACK_RECORD_BOARD_EXPOSURE_LABELS,
  TRACK_RECORD_DOLLAR_BAND_LABELS,
  TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS,
  TRACK_RECORD_PNL_LABELS,
  TRACK_RECORD_REPORTED_TO_LABELS as REPORTED_TO,
  TRACK_RECORD_SIZE_BAND_LABELS,
} from '@/lib/constants/track-record'

export type CaseInput = {
  trackRecord: {
    largestTeamManaged: TrackRecordSizeBand | null
    peopleHiredDirectly: TrackRecordSizeBand | null
    budgetOwned: TrackRecordDollarBand | null
    largestInitiativeScope: TrackRecordDollarBand | null
    pnlAccountability: TrackRecordPnlAccountability | null
    boardExposure: TrackRecordBoardExposure | null
    geographicScope: TrackRecordGeographicScope | null
    reportedToLevel: TrackRecordReportedToLevel | null
    ledThroughRestructuring: boolean | null
  } | null
  workSamples: { title: string; outcome: string | null; beforeMetric: string | null; afterMetric: string | null }[]
  quotes: { theme: string; quoteText: string }[]
  completedReferences: number
  learning: { title: string; completedAt: Date }[]
  now?: Date
}

export type Gap = { key: string; label: string; why: string; href: string }

export type Case = {
  results: string[] // plain facts, only what the member recorded
  samples: { title: string; line: string }[]
  quotes: { theme: string; text: string }[]
  learning: string[]
  gaps: Gap[]
  strength: 'STARTING' | 'BUILDING' | 'STRONG'
}

const none = (v: string | null | undefined) => !v || v === 'NONE'

export function buildCase(input: CaseInput): Case {
  const now = input.now ?? new Date()
  const t = input.trackRecord
  const results: string[] = []
  if (t) {
    if (!none(t.largestTeamManaged)) results.push(`Led a team of ${TRACK_RECORD_SIZE_BAND_LABELS[t.largestTeamManaged!]} people`)
    if (!none(t.peopleHiredDirectly)) results.push(`Hired ${TRACK_RECORD_SIZE_BAND_LABELS[t.peopleHiredDirectly!]} people directly`)
    if (!none(t.budgetOwned)) results.push(`Owned a budget of ${TRACK_RECORD_DOLLAR_BAND_LABELS[t.budgetOwned!]}`)
    if (!none(t.largestInitiativeScope)) results.push(`Delivered an initiative worth ${TRACK_RECORD_DOLLAR_BAND_LABELS[t.largestInitiativeScope!]}`)
    if (t.pnlAccountability && !none(t.pnlAccountability)) results.push(`P&L accountability: ${TRACK_RECORD_PNL_LABELS[t.pnlAccountability]}`)
    if (t.geographicScope && !none(t.geographicScope)) results.push(`Scope: ${TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS[t.geographicScope]}`)
    if (t.boardExposure && !none(t.boardExposure)) results.push(`Board exposure: ${TRACK_RECORD_BOARD_EXPOSURE_LABELS[t.boardExposure]}`)
    if (t.reportedToLevel && !none(t.reportedToLevel)) results.push(`Reported to: ${REPORTED_TO[t.reportedToLevel]}`)
    if (t.ledThroughRestructuring) results.push('Led a team through a restructuring')
  }

  const samples = input.workSamples.slice(0, 5).map((w) => ({
    title: w.title,
    line: w.beforeMetric && w.afterMetric ? `${w.beforeMetric} to ${w.afterMetric}` : (w.outcome ?? 'Add the result to this sample so it counts.'),
  }))
  const quotes = input.quotes.slice(0, 3).map((q) => ({ theme: q.theme, text: q.quoteText }))
  const yearAgo = now.getTime() - 365 * 86_400_000
  const learning = input.learning.filter((l) => l.completedAt.getTime() >= yearAgo).slice(0, 5).map((l) => l.title)

  const gaps: Gap[] = []
  if (results.length === 0) {
    gaps.push({
      key: 'trackRecord',
      label: 'Fill in your Track Record',
      why: 'The size of the teams, budgets and scope you have owned are the facts a raise or promotion case rests on.',
      href: '/dashboard/track-record',
    })
  }
  if (input.workSamples.length === 0) {
    gaps.push({
      key: 'workSamples',
      label: 'Add a work sample with its result',
      why: 'One piece of work with a before and after number is worth more than a list of responsibilities.',
      href: '/dashboard/work-samples',
    })
  }
  if (input.quotes.length === 0) {
    gaps.push({
      key: 'references',
      label: input.completedReferences > 0 ? 'Approve a quote from your references' : 'Ask someone who has worked with you for a reference',
      why: 'What others say about your work is the proof that you are not the only one saying it.',
      href: '/dashboard/references',
    })
  }
  if (learning.length === 0) {
    gaps.push({
      key: 'learning',
      label: 'Log something you learned this year',
      why: 'Showing you keep building skills answers the question of whether you are growing into the next level.',
      href: '/dashboard/learning',
    })
  }

  const have = [results.length > 0, samples.length > 0, quotes.length > 0, learning.length > 0].filter(Boolean).length
  return { results, samples, quotes, learning, gaps, strength: have >= 4 ? 'STRONG' : have >= 2 ? 'BUILDING' : 'STARTING' }
}
