import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { auditCsv, auditDiagnostics, runIndexAudit } from '@/lib/google/index-audit'
import { captureServerEvent } from '@/lib/posthog/server'

// A run stops at 200 seconds and returns what it has (src/lib/google/index-audit.ts), well inside this limit.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  // ?check=1: what a run would use, as JSON in a few seconds, with nothing inspected. Shows which stage is slow if a run does not finish.
  if (req.nextUrl.searchParams.get('check')) {
    const info = await auditDiagnostics(req.nextUrl.searchParams.get('group') || undefined)
    return NextResponse.json(info, { status: 'error' in info ? 502 : 200, headers: { 'Cache-Control': 'no-store' } })
  }
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
