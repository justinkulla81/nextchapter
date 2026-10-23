import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { suppressionRows, updatesExportRows } from '@/lib/higher-ed/views'
import { csvContentHeaders, rowsToCsv } from '@/lib/admin/csv-export'
import { captureServerEvent } from '@/lib/posthog/server'
import { etplRows, wioaOn, wioaReport } from '@/lib/higher-ed/programs'
import { memberExport } from '@/lib/higher-ed/data-requests'
import { recordInstitutionAudit } from '@/lib/higher-ed/partner-audit'
import { blockedExport, lockedReason } from '@/lib/plans/entitlements'
import type { WorkspaceContext } from '@/lib/higher-ed/access'

const UPDATES_COLUMNS = ['external_id', 'email', 'employer', 'title', 'start_date', 'in_transition', 'do_not_solicit', 'prospect_flag', 'engagement_tier', 'last_active', 'email_status'] as const
const ETPL_COLUMNS = ['program', 'cip_code', 'credential_type', 'credential', 'hours', 'cost', 'modality', 'prerequisites', 'enrolled', 'completed', 'completion_rate', 'credential_rate', 'placement_rate_180d'] as const
const WIOA_COLUMNS = ['first_name', 'last_name', 'email', 'program', 'cohort', 'funding', 'status', 'enrolled', 'completed', 'credential', 'placed', 'employer'] as const
const SUPPRESSION_COLUMNS = ['external_id', 'email', 'first_name', 'last_name', 'since', 'grace_ends'] as const

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)
// A CRM opens these in a spreadsheet: a cell starting with = + - @ is text.
const safe = (v: unknown) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)

function csv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const header = columns.join(',')
  if (!rows.length) return header
  return rowsToCsv(rows.map((r) => Object.fromEntries(columns.map((c) => [c, safe(day(r[c]))]))))
}

// The free plan has no exports or CRM exchange: a plain-language 402, not a
// broken download. An alum's own data and a staff member-data request (privacy
// rights) are never gated.
function exportBlock(ctx: WorkspaceContext, kind: string): NextResponse | null {
  const feature = blockedExport(kind, ctx.institution.plan)
  if (!feature) return null
  captureServerEvent(ctx.userId, 'entitlement_export_blocked', { slug: ctx.institution.slug, kind, feature, plan: ctx.institution.plan })
  return NextResponse.json({ error: lockedReason(feature) }, { status: 402 })
}

// CRM exchange downloads (spec §9): the updates file Development imports
// into the CRM, and the do-not-solicit suppression list.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params
  const stamp = new Date().toISOString().slice(0, 10)

  // FERPA: an alum's own record, or (admin) any member's, as JSON.
  if (kind === 'my-data' || kind === 'member-data') {
    const ctx = await requireWorkspace(slug, kind === 'my-data' ? 'candidate' : 'admin')
    const memberId = kind === 'my-data' ? ctx.memberId : _request.nextUrl.searchParams.get('memberId')
    if (!memberId) return NextResponse.json({ error: 'No member record.' }, { status: 404 })
    const data = await memberExport(ctx.institution.id, memberId)
    if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    if (kind === 'member-data' && !ctx.readOnly) {
      // Logged (already done) so the college can show what it disclosed and when.
      const by = ctx.email ?? ctx.userId
      await prisma.dataRequest.create({ data: { institutionId: ctx.institution.id, memberId, email: data.member.email, kind: 'EXPORT', status: 'DONE', note: 'Downloaded by staff.', requestedBy: by, completedBy: by, completedAt: new Date() } })
    }
    captureServerEvent(ctx.userId, kind === 'my-data' ? 'he_my_data_exported' : 'he_member_data_exported', { institutionId: ctx.institution.id, memberId })
    if (kind === 'member-data') await recordInstitutionAudit(ctx, 'export.member_data', { type: 'member', id: memberId })
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}-${kind}-${stamp}.json"`, 'Cache-Control': 'no-store' },
    })
  }

  if (kind === 'updates') {
    const ctx = await requireWorkspace(slug, 'development')
    const blocked = exportBlock(ctx, 'updates')
    if (blocked) return blocked
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
    await recordInstitutionAudit(ctx, 'export.updates', { type: 'export', detail: { rows: rows.length } })
    return new NextResponse(csv(UPDATES_COLUMNS, rows), { headers: csvContentHeaders(`${slug}-updates-${stamp}.csv`) })
  }

  if (kind === 'suppression') {
    const ctx = await requireWorkspace(slug, 'development')
    const blocked = exportBlock(ctx, 'suppression')
    if (blocked) return blocked
    const rows = await suppressionRows(ctx)
    captureServerEvent(ctx.userId, 'he_suppression_exported', { institutionId: ctx.institution.id, rows: rows.length })
    await recordInstitutionAudit(ctx, 'export.suppression', { type: 'export', detail: { rows: rows.length } })
    return new NextResponse(csv(SUPPRESSION_COLUMNS, rows), { headers: csvContentHeaders(`${slug}-do-not-solicit-${stamp}.csv`) })
  }

  if (kind === 'etpl') {
    const ctx = await requireWorkspace(slug, 'workforce')
    const blocked = exportBlock(ctx, 'etpl')
    if (blocked) return blocked
    const rows = (await etplRows(ctx.institution.id)).map((r) => ({
      program: r.name, cip_code: r.cipCode, credential_type: r.credentialType, credential: r.credential, hours: r.hours, cost: r.costCents / 100, modality: r.modality,
      prerequisites: r.prerequisites, enrolled: r.enrolled, completed: r.completed, completion_rate: r.completionRate === null ? null : Math.round(r.completionRate * 1000) / 10,
      credential_rate: r.credentialRate === null ? null : Math.round(r.credentialRate * 1000) / 10, placement_rate_180d: r.placementRate === null ? null : Math.round(r.placementRate * 1000) / 10,
    }))
    captureServerEvent(ctx.userId, 'he_etpl_exported', { institutionId: ctx.institution.id, programs: rows.length })
    await recordInstitutionAudit(ctx, 'export.etpl', { type: 'export', detail: { rows: rows.length } })
    return new NextResponse(csv(ETPL_COLUMNS, rows), { headers: csvContentHeaders(`${slug}-etpl-${stamp}.csv`) })
  }

  if (kind === 'wioa') {
    const ctx = await requireWorkspace(slug, 'workforce')
    const blocked = exportBlock(ctx, 'wioa')
    if (blocked) return blocked
    const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
    if (!wioaOn(inst.enabledFeatures)) return NextResponse.json({ error: 'WIOA is off for this college' }, { status: 404 })
    const r = await wioaReport(ctx.institution.id)
    const rows = r.rows.map((x) => ({
      first_name: x.firstName, last_name: x.lastName, email: x.email, program: x.program, cohort: x.cohort, funding: x.payer.toLowerCase(),
      status: x.status.toLowerCase(), enrolled: x.enrolledAt, completed: x.completedAt, credential: x.credential, placed: x.placedAt, employer: x.employer,
    }))
    captureServerEvent(ctx.userId, 'he_wioa_exported', { institutionId: ctx.institution.id, rows: rows.length })
    await recordInstitutionAudit(ctx, 'export.wioa', { type: 'export', detail: { rows: rows.length } })
    return new NextResponse(csv(WIOA_COLUMNS, rows), { headers: csvContentHeaders(`${slug}-wioa-participants-${stamp}.csv`) })
  }

  return NextResponse.json({ error: 'Unknown export' }, { status: 404 })
}
