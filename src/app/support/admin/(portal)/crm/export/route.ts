import type { NextRequest } from 'next/server'
import type { Prisma, CrmPersonRole, CrmLeadQuality, CrmWarmth } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 60

/** RFC-4180 quoting — the notes field routinely contains commas and quotes. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Downloads the current filtered view, using the SAME column names the
// importer reads back — so an export can be edited in a spreadsheet and
// re-uploaded without remapping anything.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const role = sp.get('role') ?? ''
  const quality = sp.get('quality') ?? ''
  const warmth = sp.get('warmth') ?? ''
  const touched = sp.get('touched') ?? ''

  const where: Prisma.CrmPersonWhereInput = {
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { affiliations: { some: { org: { name: { contains: q, mode: 'insensitive' } } } } },
            { affiliations: { some: { title: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(role ? { roles: { has: role as CrmPersonRole } } : {}),
    ...(quality ? { leadQuality: quality as CrmLeadQuality } : {}),
    ...(warmth ? { warmth: warmth as CrmWarmth } : {}),
    ...(touched === 'never' ? { lastTouchedAt: null } : {}),
    ...(touched === 'ever' ? { lastTouchedAt: { not: null } } : {}),
  }

  const rows = await prisma.crmPerson.findMany({
    where,
    orderBy: [{ priorityScore: 'desc' }, { fullName: 'asc' }],
    select: {
      id: true, fullName: true, firstName: true, lastName: true, email: true,
      linkedinUrl: true, roles: true, leadQuality: true, warmth: true, notes: true,
      lastTouchedAt: true, touchCount: true, connectedAt: true,
      affiliations: { where: { isPrimary: true }, take: 1, select: { title: true, org: { select: { name: true } } } },
    },
  })

  const HEADERS = [
    'CRM ID', 'Full Name', 'First Name', 'Last Name', 'Company', 'Position',
    'Email', 'LinkedIn URL', 'Contact Types', 'Lead Quality', 'Warmth',
    'Last Contacted', 'Touches', 'Connected On', 'Notes',
  ]
  const body = rows.map((p) =>
    [
      p.id, p.fullName, p.firstName, p.lastName,
      p.affiliations[0]?.org.name ?? '', p.affiliations[0]?.title ?? '',
      p.email, p.linkedinUrl, p.roles.join('; '), p.leadQuality, p.warmth,
      p.lastTouchedAt?.toISOString().slice(0, 10) ?? '', p.touchCount,
      p.connectedAt?.toISOString().slice(0, 10) ?? '', p.notes,
    ].map(csvCell).join(',')
  )

  captureServerEvent(admin.email ?? 'admin', 'crm_exported', { rows: rows.length, filtered: Boolean(q || role || quality || warmth || touched) })

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response([HEADERS.join(','), ...body].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nextchapter-crm-people-${stamp}.csv"`,
    },
  })
}
