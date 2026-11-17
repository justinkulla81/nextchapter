import 'server-only'
import { prisma } from '@/lib/prisma'
import { planOf } from '@/lib/plans/entitlements'

// Admin › Accounts: every organization account, whether it is a demo, free or paid, and how much it is used. Admin only,
// bounded reads (a few hundred rows at most); usage is the last 30 days.

export type AccountKind = 'demo' | 'free' | 'paid'
const DAY = 86_400_000

export type InstitutionAccount = {
  id: string; name: string; slug: string; type: string; account: AccountKind; tier: string; createdAt: Date
  demoRequestedBy: string | null; demoExpiresAt: string | null
  staffActive: number; staffInvited: number; members: number; joined: number; joined30: number; actions30: number; lastActivity: Date | null
}
export type HiringAccount = { id: string; company: string; account: AccountKind; createdAt: Date; activeRoles: number; views30: number; lastView: Date | null }
export type OutplacementAccount = { id: string; name: string; account: AccountKind; createdAt: Date; contracts: number; seats: number; activated: number; views30: number; lastView: Date | null }

const latest = (...ds: (Date | null | undefined)[]) => ds.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null

export async function accountsOverview(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY)

  // ── Colleges and workforce organizations ──
  const insts = await prisma.institution.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, name: true, slug: true, orgType: true, plan: true, tier: true, isDemo: true, createdAt: true, enabledFeatures: true },
  })
  const ids = insts.map((i) => i.id)
  const [staff, members, joined, joined30, lastJoin, actions, lastAction] = ids.length
    ? await Promise.all([
        prisma.institutionUser.groupBy({ by: ['institutionId', 'acceptedAt'], where: { institutionId: { in: ids }, revokedAt: null }, _count: { _all: true } }),
        prisma.institutionMember.groupBy({ by: ['institutionId'], where: { institutionId: { in: ids } }, _count: { _all: true } }),
        prisma.institutionMember.groupBy({ by: ['institutionId'], where: { institutionId: { in: ids }, status: { in: ['CLAIMED', 'ACTIVE'] } }, _count: { _all: true } }),
        prisma.institutionMember.groupBy({ by: ['institutionId'], where: { institutionId: { in: ids }, claimedAt: { gte: since } }, _count: { _all: true } }),
        prisma.institutionMember.groupBy({ by: ['institutionId'], where: { institutionId: { in: ids } }, _max: { claimedAt: true } }),
        prisma.partnerAuditEvent.groupBy({ by: ['refId'], where: { portal: { in: ['HIGHER_ED', 'WORKFORCE'] }, refId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
        prisma.partnerAuditEvent.groupBy({ by: ['refId'], where: { portal: { in: ['HIGHER_ED', 'WORKFORCE'] }, refId: { in: ids } }, _max: { createdAt: true } }),
      ])
    : [[], [], [], [], [], [], []]
  const count = <T extends { _count: { _all: number } }>(rows: T[], key: (r: T) => string) => new Map(rows.map((r) => [key(r), r._count._all]))
  const memberN = count(members, (r) => r.institutionId)
  const joinedN = count(joined, (r) => r.institutionId)
  const joined30N = count(joined30, (r) => r.institutionId)
  const actionsN = count(actions, (r) => r.refId)
  const lastJoinAt = new Map(lastJoin.map((r) => [r.institutionId, r._max.claimedAt]))
  const lastActionAt = new Map(lastAction.map((r) => [r.refId, r._max.createdAt]))
  const institutions: InstitutionAccount[] = insts.map((i) => {
    const demo = (i.enabledFeatures as { demo?: { requestedBy?: string | null; expiresAt?: string | null } } | null)?.demo
    const s = staff.filter((r) => r.institutionId === i.id)
    return {
      id: i.id, name: i.name, slug: i.slug, type: i.orgType ?? 'COLLEGE', tier: i.tier, createdAt: i.createdAt,
      account: i.isDemo ? 'demo' : planOf(i.plan) === 'FREE' ? 'free' : 'paid',
      demoRequestedBy: i.isDemo ? (demo?.requestedBy ?? null) : null, demoExpiresAt: i.isDemo ? (demo?.expiresAt ?? null) : null,
      staffActive: s.filter((r) => r.acceptedAt).reduce((n, r) => n + r._count._all, 0),
      staffInvited: s.filter((r) => !r.acceptedAt).reduce((n, r) => n + r._count._all, 0),
      members: memberN.get(i.id) ?? 0, joined: joinedN.get(i.id) ?? 0, joined30: joined30N.get(i.id) ?? 0, actions30: actionsN.get(i.id) ?? 0,
      lastActivity: latest(lastJoinAt.get(i.id), lastActionAt.get(i.id)),
    }
  })

  // ── Hiring accounts (one per employer login owner) ──
  const profiles = await prisma.employerProfile.findMany({ orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, userId: true, companyName: true, createdAt: true } })
  const pIds = profiles.map((p) => p.id)
  const [hiringWs, roles, hiringViews] = pIds.length
    ? await Promise.all([
        prisma.orgWorkspace.findMany({ where: { type: 'HIRING', refId: { in: pIds } }, select: { refId: true, plan: true, org: { select: { isDemo: true } } } }),
        prisma.roleProfile.groupBy({ by: ['employerId'], where: { employerId: { in: pIds }, isActive: true }, _count: { _all: true } }),
        prisma.portalPageActivityEvent.groupBy({ by: ['userId'], where: { portal: 'TALENT', userId: { in: profiles.map((p) => p.userId) }, createdAt: { gte: since } }, _count: { _all: true }, _max: { createdAt: true } }),
      ])
    : [[], [], []]
  const wsFor = new Map(hiringWs.map((w) => [w.refId, w]))
  const roleN = count(roles, (r) => r.employerId)
  const viewsBy = new Map(hiringViews.map((v) => [v.userId, v]))
  const hiring: HiringAccount[] = profiles.map((p) => {
    const ws = wsFor.get(p.id)
    const v = viewsBy.get(p.userId)
    return {
      id: p.id, company: p.companyName, createdAt: p.createdAt, activeRoles: roleN.get(p.id) ?? 0, views30: v?._count._all ?? 0, lastView: v?._max.createdAt ?? null,
      account: ws?.org.isDemo ? 'demo' : ws && ws.plan !== 'FREE' ? 'paid' : 'free',
    }
  })

  // ── Outplacement and Employees (contract-based) ──
  const orgs = await prisma.outplacementEmployerOrg.findMany({ orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, name: true, createdAt: true } })
  const oIds = orgs.map((o) => o.id)
  const [contracts, activated, orgUsers, orgWs] = oIds.length
    ? await Promise.all([
        prisma.outplacementContract.groupBy({ by: ['orgId'], where: { orgId: { in: oIds }, status: 'ACTIVE' }, _count: { _all: true }, _sum: { seatCount: true } }),
        prisma.outplacementSeat.groupBy({ by: ['contractId'], where: { contract: { orgId: { in: oIds } }, activatedAt: { not: null } }, _count: { _all: true } }),
        prisma.outplacementOrgUser.findMany({ where: { orgId: { in: oIds }, userId: { not: null } }, select: { orgId: true, userId: true } }),
        prisma.orgWorkspace.findMany({ where: { type: { in: ['OUTPLACEMENT', 'EMPLOYEES'] }, refId: { in: oIds } }, select: { refId: true, org: { select: { isDemo: true } } } }),
      ])
    : [[], [], [], []]
  const contractOrg = oIds.length ? new Map((await prisma.outplacementContract.findMany({ where: { orgId: { in: oIds } }, select: { id: true, orgId: true } })).map((c) => [c.id, c.orgId])) : new Map<string, string>()
  const activatedBy = new Map<string, number>()
  for (const a of activated) {
    const org = contractOrg.get(a.contractId)
    if (org) activatedBy.set(org, (activatedBy.get(org) ?? 0) + a._count._all)
  }
  const userIds = orgUsers.map((u) => u.userId!).filter(Boolean)
  const empViews = userIds.length
    ? await prisma.portalPageActivityEvent.groupBy({ by: ['userId'], where: { portal: 'EMPLOYER', userId: { in: userIds }, createdAt: { gte: since } }, _count: { _all: true }, _max: { createdAt: true } })
    : []
  const empViewBy = new Map(empViews.map((v) => [v.userId, v]))
  const outplacement: OutplacementAccount[] = orgs.map((o) => {
    const c = contracts.find((r) => r.orgId === o.id)
    const users = orgUsers.filter((u) => u.orgId === o.id).map((u) => empViewBy.get(u.userId!)).filter(Boolean)
    const demo = orgWs.some((w) => w.refId === o.id && w.org.isDemo)
    return {
      id: o.id, name: o.name, createdAt: o.createdAt, contracts: c?._count._all ?? 0, seats: c?._sum.seatCount ?? 0, activated: activatedBy.get(o.id) ?? 0,
      views30: users.reduce((n, v) => n + (v?._count._all ?? 0), 0), lastView: latest(...users.map((v) => v?._max.createdAt ?? null)),
      account: demo ? 'demo' : (c?._count._all ?? 0) > 0 ? 'paid' : 'free',
    }
  })

  return { institutions, hiring, outplacement, umbrellaDemos: await prisma.organization.count({ where: { isDemo: true } }) }
}
