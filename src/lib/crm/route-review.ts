import 'server-only'
import type { CrmIntroPathStrength, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { orgSlug } from '@/lib/crm/org-slug'

// Routes in that have never been checked. A route counts as a way in once it is
// rated STRONG or MEDIUM (see warm-doors-rules.ts), but a route still at
// IDENTIFIED has not been asked about or confirmed by anyone — most were seeded
// from a spreadsheet note ("route via X"). They sit on the Review List until a
// person confirms, re-rates, or declines them on the organization page.
//
// Grouped by target organization: one org with two connectors is one decision.

const RATED: CrmIntroPathStrength[] = ['STRONG', 'MEDIUM']

export const ROUTES_TO_CONFIRM: Prisma.CrmIntroPathWhereInput = {
  targetOrgId: { not: null },
  status: 'IDENTIFIED',
  strength: { in: RATED },
}

export async function countRoutesToConfirm(): Promise<number> {
  const groups = await prisma.crmIntroPath.groupBy({ by: ['targetOrgId'], where: ROUTES_TO_CONFIRM })
  return groups.length
}

export interface RouteToConfirm {
  id: string
  strength: CrmIntroPathStrength
  connector: { personId: string | null; name: string }
  note: string | null
  createdAt: Date
}

export interface OrgRoutesToConfirm {
  org: { id: string; name: string; href: string }
  routes: RouteToConfirm[]
}

export async function loadRoutesToConfirm(): Promise<OrgRoutesToConfirm[]> {
  const rows = await prisma.crmIntroPath.findMany({
    where: ROUTES_TO_CONFIRM,
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true, strength: true, connectorName: true, relationshipNote: true, createdAt: true,
      connectorPerson: { select: { id: true, fullName: true } },
      targetOrg: { select: { id: true, name: true, canonicalNameNormalized: true } },
    },
  })
  const byOrg = new Map<string, OrgRoutesToConfirm>()
  for (const r of rows) {
    if (!r.targetOrg) continue
    const group = byOrg.get(r.targetOrg.id) ?? {
      org: {
        id: r.targetOrg.id,
        name: r.targetOrg.name,
        href: `/support/admin/crm/organizations/${orgSlug(r.targetOrg.canonicalNameNormalized) ?? r.targetOrg.id}`,
      },
      routes: [],
    }
    group.routes.push({
      id: r.id,
      strength: r.strength,
      connector: { personId: r.connectorPerson?.id ?? null, name: r.connectorPerson?.fullName ?? r.connectorName ?? 'Unnamed connector' },
      note: r.relationshipNote,
      createdAt: r.createdAt,
    })
    byOrg.set(r.targetOrg.id, group)
  }
  return [...byOrg.values()].sort((a, b) => a.org.name.localeCompare(b.org.name))
}
