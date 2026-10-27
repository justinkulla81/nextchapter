import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { exportSearchTerms, searchTermsCsv } from '@/lib/google/search-console'
import { captureServerEvent } from '@/lib/posthog/server'

// Several 25,000-row pages from Google; more than a page render's budget.
export const maxDuration = 120

export async function GET() {
  const admin = await requireAdmin()
  const result = await exportSearchTerms()
  if ('error' in result) return NextResponse.json({ ok: false, message: result.error }, { status: 502 })
  captureServerEvent(admin.email ?? 'admin', 'search_console_terms_exported', { rows: result.rows.length, startDate: result.startDate, endDate: result.endDate })
  return new NextResponse(searchTermsCsv(result.rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="search-console-terms-${result.endDate}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
