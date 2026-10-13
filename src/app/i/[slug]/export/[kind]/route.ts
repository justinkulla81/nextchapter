import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { suppressionRows, updatesExportRows } from '@/lib/higher-ed/views'
import { csvContentHeaders, rowsToCsv } from '@/lib/admin/csv-export'
import { captureServerEvent } from '@/lib/posthog/server'

const UPDATES_COLUMNS = ['external_id', 'email', 'employer', 'title', 'start_date', 'in_transition', 'do_not_solicit', 'prospect_flag', 'engagement_tier', 'last_active', 'email_status'] as const
const SUPPRESSION_COLUMNS = ['external_id', 'email', 'first_name', 'last_name', 'since', 'grace_ends'] as const

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)
// A CRM opens these in a spreadsheet: a cell starting with = + - @ is text.
const safe = (v: unknown) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)

function csv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const header = columns.join(',')
  if (!rows.length) return header
  return rowsToCsv(rows.map((r) => Object.fromEntries(columns.map((c) => [c, safe(day(r[c]))]))))
}

// CRM exchange downloads (spec §9): the updates file Development imports
// into the CRM, and the do-not-solicit suppression list.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params
  const stamp = new Date().toISOString().slice(0, 10)

  if (kind === 'updates') {
    const ctx = await requireWorkspace(slug, 'development')
    const started = new Date()
    const rows = await updatesExportRows(ctx)
    // Approved signals in this file count as exported, and the run is logged
    // next to the imports. A read-only seat can download but changes nothing.
    const exported = ctx.readOnly
      ? { count: 0 }
      : await prisma.prospectFlag.updateMany({
          where: { institutionId: ctx.institution.id, approvedAt: { not: null }, dismissedAt: null, exportedAt: null },
          data: { exportedAt: started },
        })
    if (!ctx.readOnly) {
      await prisma.crmExchangeRun.create({
        data: { institutionId: ctx.institution.id, direction: 'EXPORT_UPDATES', fileName: `${slug}-updates-${stamp}.csv`, rowCount: rows.length, status: 'SUCCEEDED', createdBy: ctx.email ?? ctx.userId, startedAt: started, completedAt: new Date() },
      })
    }
    captureServerEvent(ctx.userId, 'he_crm_updates_exported', { institutionId: ctx.institution.id, rows: rows.length, signals: exported.count })
    return new NextResponse(csv(UPDATES_COLUMNS, rows), { headers: csvContentHeaders(`${slug}-updates-${stamp}.csv`) })
  }

  if (kind === 'suppression') {
    const ctx = await requireWorkspace(slug, 'development')
    const rows = await suppressionRows(ctx)
    captureServerEvent(ctx.userId, 'he_suppression_exported', { institutionId: ctx.institution.id, rows: rows.length })
    return new NextResponse(csv(SUPPRESSION_COLUMNS, rows), { headers: csvContentHeaders(`${slug}-do-not-solicit-${stamp}.csv`) })
  }

  return NextResponse.json({ error: 'Unknown export' }, { status: 404 })
}
