import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { generateMarketRealitySnapshot } from '@/lib/scoring/market-reality-snapshot'
import { runWeeklyCalibrationCheck } from '@/lib/scoring/market-reality/calibration'
import { sendGradeCalibratedUpEmail } from '@/lib/email/send-grade-calibrated-up-email'
import type { Grade } from '@/lib/scoring/grade'

// Fires Monday afternoon (see vercel.json) — well after auto-assign-sprint's
// ~5am ET run, so every candidate already has this week's Search Actions
// auto-assigned before this week's Current Market Reality snapshot is
// generated and archived. Idempotent per (candidateId, weekStartDate).
//
// Piggybacks the calibration loop (calibration.ts) directly onto this same
// weekly run rather than a separate cron entry: generateMarketRealitySnapshot
// already seeds/refreshes probabilityGrade for the week via
// computeProbabilityGrade, so runWeeklyCalibrationCheck immediately after it
// is comparing against this week's real band, and any adjustment it applies
// is reflected before the candidate's next dashboard load.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, isSampleData: false },
    select: { id: true, userId: true, firstName: true },
  })

  let generated = 0
  let calibrated = 0
  for (const candidate of eligible) {
    try {
      await generateMarketRealitySnapshot(candidate.id, weekStartDate)
      generated += 1
    } catch (error) {
      console.error('Market Reality snapshot failed for candidate', candidate.id, error)
      continue
    }

    try {
      const before = await prisma.marketRealityComponentScore.findUnique({
        where: { candidateId: candidate.id },
        select: { probabilityGrade: true },
      })
      const check = await runWeeklyCalibrationCheck(candidate.id, weekStartDate)
      if (check.bandCrossed && check.newProbabilityGrade) {
        calibrated += 1
        if (check.gapDirection === 'OVER' && before?.probabilityGrade) {
          await sendGradeCalibratedUpEmail(candidate, before.probabilityGrade as Grade, check.newProbabilityGrade)
        }
      }
    } catch (error) {
      console.error('Market Reality calibration check failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, generated, calibrated })
}
