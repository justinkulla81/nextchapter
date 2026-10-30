import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { csvContentHeaders, rowsToCsv } from '@/lib/admin/csv-export'
import { organizationsWhere } from '@/lib/crm/organizations-filter'
import { addedSince, readAdded } from '@/lib/crm/added-since'
import { ORG_TYPE_LABELS, QUALITY_LABELS } from '@/lib/crm/labels'

export const maxDuration = 60

/** A spreadsheet stays usable at this size; narrow the filters for more. */
const MAX_ROWS = 5000

// The Organizations list as filtered on screen, one row per organization, with the two
// contacts the pitch needs (CHRO, head of L&D) and the two grading signals.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const baseWhere = await organizationsWhere(params)
  const added = readAdded(params.added)
  const where = added ? { AND: [baseWhere, { createdAt: { gte: addedSince(added) } }] } : baseWhere

  const orgs = await prisma.crmOrganization.findMany({
    where,
    orderBy: [{ priorityScore: 'desc' }, { name: 'asc' }],
    take: MAX_ROWS,
    select: {
      id: true, name: true, orgTypes: true, leadQuality: true, emailDomain: true, website: true, companyId: true,
      affiliations: {
        where: {
          isCurrent: true,
          person: { deletedAt: null, mergedIntoId: null, roles: { hasSome: ['CHRO', 'LEARNING_DEV_HEAD'] } },
        },
        select: { title: true, person: { select: { fullName: true, email: true, roles: true } } },
      },
    },
  })

  const companyIds = orgs.map((o) => o.companyId).filter((id): id is string => !!id)
  const [notices, profiles] = await Promise.all([
    prisma.warnNotice.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _max: { noticeDate: true },
      _sum: { employees: true },
    }),
    prisma.companyHiringProfile.findMany({ where: { companyId: { in: companyIds } }, select: { companyId: true, openNow: true } }),
  ])
  const noticeBy = new Map(notices.map((n) => [n.companyId, n]))
  const openBy = new Map(profiles.map((p) => [p.companyId, p.openNow]))

  const join = (xs: (string | null | undefined)[]) => xs.filter(Boolean).join('; ')
  const rows = orgs.map((o) => {
    const chro = o.affiliations.filter((a) => a.person.roles.includes('CHRO'))
    const ld = o.affiliations.filter((a) => a.person.roles.includes('LEARNING_DEV_HEAD'))
    const notice = o.companyId ? noticeBy.get(o.companyId) : undefined
    return {
      Company: o.name,
      Types: o.orgTypes.map((t) => ORG_TYPE_LABELS[t]).join('; '),
      Grade: QUALITY_LABELS[o.leadQuality],
      'Last layoff notice': notice?._max.noticeDate?.toISOString().slice(0, 10) ?? '',
      'Employees in notices': notice?._sum.employees ?? '',
      'Open jobs now': o.companyId ? (openBy.get(o.companyId) ?? 0) : '',
      CHRO: join(chro.map((a) => a.person.fullName)),
      'CHRO title': join(chro.map((a) => a.title)),
      'CHRO email': join(chro.map((a) => a.person.email)),
      'Head of L&D': join(ld.map((a) => a.person.fullName)),
      'Head of L&D title': join(ld.map((a) => a.title)),
      'Head of L&D email': join(ld.map((a) => a.person.email)),
      'Email domain': o.emailDomain ?? '',
      Website: o.website ?? '',
    }
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_organizations_exported', { rows: rows.length, capped: orgs.length === MAX_ROWS, filters: Object.keys(params).filter((k) => params[k]) })

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(rowsToCsv(rows), { headers: csvContentHeaders(`nextchapter-organizations-${stamp}.csv`) })
}
