import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { auditCsv, runIndexAudit } from '@/lib/google/index-audit'
import { captureServerEvent } from '@/lib/posthog/server'

// About 300 inspections at five a time, plus the sitemap fetches.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const per = Math.min(40, Math.max(5, Number(req.nextUrl.searchParams.get('per')) || 10))
  const group = req.nextUrl.searchParams.get('group') || undefined
  const result = await runIndexAudit(per, { onlyGroup: group })
  if ('error' in result) return NextResponse.json({ ok: false, message: result.error }, { status: 502 })
  captureServerEvent(admin.email ?? 'admin', 'search_console_index_audit_run', { perGroup: per, urls: result.rows.length, partial: result.partial, group: group ?? 'all' })
  return new NextResponse(auditCsv(result.rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="index-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
      // A run that hit its time budget still returns the rows it finished; this says so and how many it planned.
      'X-Audit-Checked': `${result.rows.length} of ${result.requested}`,
    },
  })
}
