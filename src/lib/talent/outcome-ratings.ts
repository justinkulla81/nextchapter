import 'server-only'
import type { CandidateInteraction } from '@prisma/client'

export type OutcomeWindow = 'thirtyDay' | 'ninetyDay' | 'sixMonth'

const WINDOW_DAYS: Record<OutcomeWindow, number> = {
  thirtyDay: 30,
  ninetyDay: 90,
  sixMonth: 180,
}

export const OUTCOME_WINDOW_LABEL: Record<OutcomeWindow, string> = {
  thirtyDay: '30-day check-in',
  ninetyDay: '90-day check-in',
  sixMonth: '6-month check-in',
}

const RATING_FIELD: Record<OutcomeWindow, keyof Pick<CandidateInteraction, 'thirtyDayRating' | 'ninetyDayRating' | 'sixMonthRating'>> = {
  thirtyDay: 'thirtyDayRating',
  ninetyDay: 'ninetyDayRating',
  sixMonth: 'sixMonthRating',
}

// Post-hire outcome loop: once an employer marks a candidate hired, prompt
// them at 30/90/180 days for a 1-5 "how's this hire working out" rating —
// pure validity-research signal, never shown back to the candidate. Only
// ever surfaces the earliest due-and-unrated window at a time so the UI
// asks one question, not three.
export function getDueOutcomeWindow(
  interaction: Pick<CandidateInteraction, 'hiredAt' | 'thirtyDayRating' | 'ninetyDayRating' | 'sixMonthRating'>
): OutcomeWindow | null {
  if (!interaction.hiredAt) return null
  const daysSinceHire = (Date.now() - interaction.hiredAt.getTime()) / (1000 * 60 * 60 * 24)

  for (const window of ['thirtyDay', 'ninetyDay', 'sixMonth'] as const) {
    const alreadyRated = interaction[RATING_FIELD[window]] != null
    if (!alreadyRated && daysSinceHire >= WINDOW_DAYS[window]) {
      return window
    }
  }
  return null
}
