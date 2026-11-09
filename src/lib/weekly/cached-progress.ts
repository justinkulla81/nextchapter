import { cache } from 'react'
import { computeWeeklyProgress } from '@/lib/weekly/weekly-engines'

/**
 * The week's progress, computed once per page render. Home reads it in three places (the number box, the note's aside and the
 * weekly plan); React's per-request cache makes them share one computation instead of each querying the sprint again.
 */
export const getWeeklyProgress = cache((candidateId: string, weekNumber: number, privacyTier: Parameters<typeof computeWeeklyProgress>[2], confidentialSearchMode: boolean) =>
  computeWeeklyProgress(candidateId, weekNumber, privacyTier, confidentialSearchMode),
)
