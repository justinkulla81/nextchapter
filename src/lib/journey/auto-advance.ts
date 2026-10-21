import 'server-only'
import { prisma } from '@/lib/prisma'
import { applyJourneyChange } from './apply'

export const LANDED_DAYS = 90

/** Members who entered Landed at or before this moment are due to move on. */
export function landedCutoff(now: Date): Date {
  return new Date(now.getTime() - LANDED_DAYS * 86_400_000)
}

// 90 days after landing, the first-90-days plan has run its course and the
// member moves to Managing your career: their journey becomes "Managing my
// career" (why they were moving is done), and their plan, menu and emails
// become the career plan. Nothing is lost: the original journey is in their
// history. Runs daily. Safe to run twice: it only touches members still in
// Landed, and the stage change takes them out of it.
export async function advanceLandedMembers(now: Date = new Date()): Promise<{ checked: number; moved: number }> {
  const cutoff = landedCutoff(now)
  const due = await prisma.candidateProfile.findMany({
    where: {
      journeyStage: 'LANDED',
      journeyStageChangedAt: { lte: cutoff },
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
    },
    select: { id: true },
    take: 500,
  })
  let moved = 0
  for (const c of due) {
    try {
      await applyJourneyChange(c.id, { journey: 'GROWING', stage: 'STAYING', source: 'AUTOMATIC', note: `${LANDED_DAYS} days after landing` }, now)
      moved += 1
    } catch (error) {
      console.error('Landed to Managing your career failed for', c.id, error)
    }
  }
  return { checked: due.length, moved }
}
