import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { rowsToCsv, csvContentHeaders } from '@/lib/admin/csv-export'
import { CAPABILITIES } from '@/lib/vision/capabilities'
import { COMPETITOR_AREAS } from '@/lib/vision/competitor-areas'
import { isStale, looksLikeMissingTable } from '@/lib/vision/capability-matrix'

export const maxDuration = 60

/**
 * The answered cells of the capability matrix as CSV, one row per competitor and capability.
 * ?area=<key> limits it to one area; without it, every area. Unknown cells are not rows: the matrix page shows them,
 * and the file stays to what someone actually checked. Stale is computed on download.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const areaParam = req.nextUrl.searchParams.get('area') ?? ''
  const area = COMPETITOR_AREAS.some((a) => a.key === areaParam) ? areaParam : ''
  const byKey = new Map(CAPABILITIES.map((c) => [c.key, c]))

  let rows
  try {
    rows = await prisma.competitorCapability.findMany({
      where: { status: { not: 'UNKNOWN' }, ...(area ? { capability: { area } } : {}) },
      select: {
        status: true, note: true, evidenceUrl: true, checkedAt: true, checkedBy: true,
        competitor: { select: { name: true, relationship: true } },
        capability: { select: { key: true, area: true, name: true, ours: true } },
      },
      orderBy: [{ capability: { area: 'asc' } }, { competitor: { name: 'asc' } }],
    })
  } catch (e) {
    const msg = looksLikeMissingTable(e)
      ? 'The capability tables are not in the database yet. Apply prisma/manual/2026-10-23-capability-matrix.sql first.'
      : 'The export could not be built. Try again.'
    return new NextResponse(msg, { status: looksLikeMissingTable(e) ? 409 : 500 })
  }

  const now = new Date()
  const out = rows.map((r) => ({
    area: r.capability.area,
    capability_key: r.capability.key,
    capability: byKey.get(r.capability.key)?.name ?? r.capability.name,
    nextchapter: r.capability.ours,
    competitor: r.competitor.name,
    relationship: r.competitor.relationship,
    status: r.status,
    note: r.note ?? '',
    evidence_url: r.evidenceUrl ?? '',
    checked_at: r.checkedAt ? r.checkedAt.toISOString().slice(0, 10) : '',
    checked_by: r.checkedBy ?? '',
    stale: isStale(r.checkedAt, now) ? 'yes' : 'no',
  }))

  captureServerEvent(admin.email ?? 'admin', 'capability_matrix_exported', { area: area || 'all', rows: out.length })
  const stamp = now.toISOString().slice(0, 10)
  return new NextResponse(out.length ? rowsToCsv(out) : 'area,capability_key,capability,nextchapter,competitor,relationship,status,note,evidence_url,checked_at,checked_by,stale\n', {
    headers: csvContentHeaders(`capability-matrix-${area || 'all'}-${stamp}.csv`),
  })
}
