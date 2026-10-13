import 'server-only'
import { prisma } from '@/lib/prisma'
import { isReviewCadence, type ReviewCadence } from './constants'
import { validMonth, type ReviewScheduleInput } from './review-schedule'

// Turn a stored InWorkProfile row (or no row) into schedule input. No row
// means the defaults: twice a year, February and August, prompts on.
export function scheduleInputFrom(
  row: { cadence: string; anchorMonth: number | null; nextReviewDate: Date | null } | null | undefined,
): ReviewScheduleInput {
  const cadence: ReviewCadence = row && isReviewCadence(row.cadence) ? row.cadence : 'HALF_YEARLY'
  return {
    cadence,
    anchorMonth: row && validMonth(row.anchorMonth) ? row.anchorMonth : null,
    nextReviewDate: row?.nextReviewDate ?? null,
  }
}

export async function getInWorkSettings(candidateId: string) {
  const row = await prisma.inWorkProfile.findUnique({ where: { candidateId } })
  return { row, schedule: scheduleInputFrom(row), promptsEnabled: row?.promptsEnabled ?? true }
}
