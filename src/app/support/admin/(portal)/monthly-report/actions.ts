'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { generateMonthlyReport } from '@/lib/reports/monthly-user/store'
import { isValidMonthKey, monthKeyOf } from '@/lib/reports/monthly-user/period'
import { captureServerEvent } from '@/lib/posthog/server'

export type GenerateReportState = { error?: string; success?: string } | undefined

// Manual "build this report now" — same computation as the month-end cron,
// for the month in progress or any month picked, so the report can be seen
// before the last day and re-run after a data fix. Overwrites that month's
// row; it does not send the email.
export async function generateMonthlyReportAction(_prev: GenerateReportState, formData: FormData): Promise<GenerateReportState> {
  const admin = await requireAdmin()
  const requested = String(formData.get('month') ?? '')
  const monthKey = isValidMonthKey(requested) ? requested : monthKeyOf(new Date())
  try {
    const report = await generateMonthlyReport(monthKey, 'manual')
    captureServerEvent(admin.email ?? 'admin', 'admin_monthly_report_generated', {
      monthKey, memberCount: report.data.memberCount, trigger: 'manual',
    })
    revalidatePath('/support/admin/monthly-report')
    return { success: `Built the ${report.data.label} report from ${report.data.memberCount} members.` }
  } catch (error) {
    console.error('generateMonthlyReportAction failed', error)
    return { error: 'Building the report failed. If this is the first run, check that the MonthlyUserReport table has been created, then try again.' }
  }
}
