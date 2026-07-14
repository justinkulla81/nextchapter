import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeAList } from '@/lib/weekly/a-list'
import { generateSundayNightReport } from '@/lib/reports/sunday-night-report'
import { sendSundayNightReportEmail } from '@/lib/email/send-sunday-night-report'

// Fires once weekly, Sunday evening (see vercel.json) — same single-fixed-
// send-time trim as the daily email cron, no true per-timezone delivery.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())

  // Computed once and shared across every candidate's report this run —
  // computeAList itself scans every WeeklySprint for the week, so doing it
  // per-candidate would be quadratic.
  const aList = await computeAList(weekStartDate)

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null } },
  })

  let generated = 0
  let sent = 0
  for (const candidate of eligible) {
    try {
      await generateSundayNightReport(candidate.id, aList)
      generated += 1

      if (!candidate.weeklyReportOptedOut) {
        const result = await sendSundayNightReportEmail(candidate.id)
        if (result.sent) sent += 1
      }
    } catch (error) {
      console.error('Sunday Night Report failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, generated, sent })
}
