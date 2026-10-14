import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { rowsToCsv, csvContentHeaders } from '@/lib/admin/csv-export'
import { getStoredReport } from '@/lib/reports/monthly-user/store'
import { isValidMonthKey } from '@/lib/reports/monthly-user/period'
import { reportToRows } from '@/lib/reports/monthly-user/csv'
import { captureServerEvent } from '@/lib/posthog/server'

// CSV of one stored monthly report. Reads the stored report only, which was
// suppressed (groups under 5) before it was saved, so nothing small can leak
// through this path.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  const month = new URL(request.url).searchParams.get('month') ?? ''
  if (!isValidMonthKey(month)) return NextResponse.json({ error: 'month must look like 2026-10' }, { status: 400 })
  const report = await getStoredReport(month)
  if (!report) return NextResponse.json({ error: `No report has been built for ${month} yet.` }, { status: 404 })

  captureServerEvent(admin.email ?? 'admin', 'admin_monthly_report_exported', { monthKey: month, memberCount: report.data.memberCount })
  return new NextResponse(rowsToCsv(reportToRows(report.data)), { headers: csvContentHeaders(`member-report-${month}.csv`) })
}
