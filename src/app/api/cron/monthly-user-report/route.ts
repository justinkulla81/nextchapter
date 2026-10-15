import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { generateMonthlyReport, markReportEmailed } from '@/lib/reports/monthly-user/store'
import { sendMonthlyReportEmail } from '@/lib/reports/monthly-user/notify'
import { isLastDayOfMonth, monthKeyOf } from '@/lib/reports/monthly-user/period'
import { captureServerEvent } from '@/lib/posthog/server'

// Internal monthly member report, built on the last day of each month.
//
// Vercel cron has no "last day of the month", so vercel.json fires this at
// 23:00 UTC on the 28th through the 31st and the handler only does the work
// when tomorrow is the 1st (UTC). The other days answer "skipped". 23:00
// leaves the platform's scheduling slack inside the day while capturing
// almost all of it.
//
// Re-running the last day regenerates the same month's row (upsert) and
// emails again — hence not in RERUN_SAFE_JOBS.
export const maxDuration = 300

export const GET = withCronRun('monthly-user-report', async () => {
  const now = new Date()
  if (!isLastDayOfMonth(now)) return NextResponse.json({ skipped: 'Not the last day of the month.' })

  const monthKey = monthKeyOf(now)
  const report = await generateMonthlyReport(monthKey, 'schedule', now)
  const emailed = await sendMonthlyReportEmail(report.data)
  if (emailed) await markReportEmailed(monthKey)

  captureServerEvent('system', 'monthly_user_report_generated', {
    monthKey, memberCount: report.data.memberCount, trigger: 'schedule', emailed,
    sections: report.data.sections.length, insights: report.data.insights.length,
  })
  return NextResponse.json({ monthKey, memberCount: report.data.memberCount, emailed })
})
