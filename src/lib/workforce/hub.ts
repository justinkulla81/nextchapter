// The Program workspace for workforce customers (boards, economic
// development orgs, chambers): the companies they serve, the people laid
// off there, and how many found work and stayed local. Counts only; a
// participant's search detail shows only when they chose to share it, and
// any group smaller than five shows as "<5".

import 'server-only'
import type { JourneyStage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { isInArea, localArea, readLocal, type LocalArea } from './local'

const DAY = 86_400_000
const SEARCHING: JourneyStage[] = ['APPLYING', 'INTERVIEWING', 'OFFER']
const INTERVIEWING: JourneyStage[] = ['INTERVIEWING', 'OFFER']

export const small = (n: number) => (n > 0 && n < MIN_CELL_SIZE ? '<5' : n.toLocaleString())

const participantWhere = (institutionId: string) => ({ institutionId, affiliation: 'PARTICIPANT' as const, status: { not: 'OPTED_OUT' as const } })

async function hires(candidateIds: string[]) {
  if (!candidateIds.length) return []
  const rows = await prisma.hireOutcome.findMany({
    where: { candidateId: { in: candidateIds } },
    orderBy: { hiredAt: 'desc' },
    select: { candidateId: true, hiredAt: true, workCity: true, workState: true, workRemote: true },
  })
  // One per person: their latest.
  const seen = new Set<string>()
  return rows.filter((r) => (seen.has(r.candidateId) ? false : (seen.add(r.candidateId), true)))
}

export type LocalSplit = { total: number; local: number; remote: number; elsewhere: number; unknown: number }

export function splitByPlace(rows: { workCity: string | null; workState: string | null; workRemote: boolean | null }[], area: LocalArea | null): LocalSplit {
  const s: LocalSplit = { total: rows.length, local: 0, remote: 0, elsewhere: 0, unknown: 0 }
  for (const r of rows) {
    if (r.workRemote) s.remote++
    else if (!r.workCity || !r.workState || !area) s.unknown++
    else if (isInArea(area, r.workCity, r.workState)) s.local++
    else s.elsewhere++
  }
  return s
}

// Kept local: on-site or hybrid in the region, plus remote (they still live here).
export const keptShare = (s: LocalSplit) => {
  const known = s.local + s.remote + s.elsewhere
  return known >= MIN_CELL_SIZE ? (s.local + s.remote) / known : null
}

export async function hubDashboard(institutionId: string, now = new Date()) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { includedSeats: true, enabledFeatures: true } })
  const people = await prisma.institutionMember.findMany({
    where: participantWhere(institutionId),
    select: {
      candidateId: true,
      isActiveSeat: true,
      candidate: { select: { journeyStage: true } },
      consents: { where: { scope: 'SHARE_OUTCOME' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } },
    },
  })
  const joinedIds = people.filter((p) => p.candidateId).map((p) => p.candidateId!)
  const sharingIds = people.filter((p) => p.candidateId && p.consents[0]?.granted).map((p) => p.candidateId!)
  const [active, hired, companies, layoffs] = await Promise.all([
    joinedIds.length
      ? prisma.candidatePageActivityEvent.groupBy({ by: ['candidateId'], where: { candidateId: { in: joinedIds }, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }).then((r) => r.length)
      : 0,
    hires(sharingIds),
    prisma.memberCompany.count({ where: { institutionId } }),
    prisma.rapidResponse.count({ where: { institutionId, memberCompanyId: { not: null } } }),
  ])
  const settings = readLocal(inst.enabledFeatures)
  const area = settings ? await localArea(settings) : null
  const split = splitByPlace(hired, area)
  const seatsUsed = people.filter((p) => p.isActiveSeat || p.candidateId).length
  return {
    participants: people.length,
    joined: joinedIds.length,
    activeThisWeek: active,
    searching: people.filter((p) => p.candidate?.journeyStage && SEARCHING.includes(p.candidate.journeyStage)).length,
    interviewing: people.filter((p) => p.candidate?.journeyStage && INTERVIEWING.includes(p.candidate.journeyStage)).length,
    landed: hired.length,
    split,
    kept: keptShare(split),
    seats: { pool: inst.includedSeats, used: seatsUsed },
    companies,
    layoffs,
    local: settings,
  }
}

export async function memberCompanies(institutionId: string) {
  const rows = await prisma.memberCompany.findMany({
    where: { institutionId },
    orderBy: { name: 'asc' },
    include: {
      layoffs: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, seats: true, isActive: true, createdAt: true, _count: { select: { participants: true } } } },
      _count: { select: { people: true } },
    },
  })
  const joined = await prisma.institutionMember.groupBy({
    by: ['memberCompanyId'],
    where: { ...participantWhere(institutionId), candidateId: { not: null }, memberCompanyId: { not: null } },
    _count: { _all: true },
  })
  const j = new Map(joined.map((r) => [r.memberCompanyId!, r._count._all]))
  return rows.map((c) => ({ ...c, participants: c._count.people, joined: j.get(c.id) ?? 0, seatsGiven: c.layoffs.reduce((n, l) => n + (l.seats ?? 0), 0) }))
}

export async function hubLayoffs(institutionId: string) {
  return prisma.rapidResponse.findMany({
    where: { institutionId, memberCompanyId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      employerName: true,
      seats: true,
      isActive: true,
      createdAt: true,
      warnNotice: { select: { employer: true, employees: true, noticeDate: true } },
      memberCompany: { select: { id: true, name: true } },
      _count: { select: { participants: true } },
    },
  })
}

export async function participants(institutionId: string, opts: { companyId?: string; q?: string; take?: number } = {}) {
  const rows = await prisma.institutionMember.findMany({
    where: {
      ...participantWhere(institutionId),
      ...(opts.companyId ? { memberCompanyId: opts.companyId } : {}),
      ...(opts.q ? { OR: [{ email: { contains: opts.q, mode: 'insensitive' as const } }, { lastName: { contains: opts.q, mode: 'insensitive' as const } }, { firstName: { contains: opts.q, mode: 'insensitive' as const } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: opts.take ?? 200,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      claimedAt: true,
      createdAt: true,
      lastKnownTitle: true,
      memberCompany: { select: { name: true } },
      candidate: { select: { journeyStage: true } },
      consents: { where: { scope: 'SHARE_SEARCH_DETAIL_WITH_CAREER' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } },
    },
  })
  return rows.map(({ consents, candidate, ...r }) => ({ ...r, stage: consents[0]?.granted ? (candidate?.journeyStage ?? null) : null, joined: !!r.claimedAt }))
}

// Where people landed: the region's share, by company (suppressed) and by city.
export async function keptInRegion(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  const settings = readLocal(inst.enabledFeatures)
  const area = settings ? await localArea(settings) : null
  // Only people who agreed to share their outcome count toward where people landed.
  const people = (
    await prisma.institutionMember.findMany({
      where: { ...participantWhere(institutionId), candidateId: { not: null } },
      select: { candidateId: true, memberCompany: { select: { name: true } }, consents: { where: { scope: 'SHARE_OUTCOME' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } } },
    })
  ).filter((p) => p.consents[0]?.granted)
  const hired = await hires(people.map((p) => p.candidateId!))
  const companyOf = new Map(people.map((p) => [p.candidateId!, p.memberCompany?.name ?? 'Signed up directly']))
  const byCompany = new Map<string, typeof hired>()
  for (const h of hired) {
    const k = companyOf.get(h.candidateId) ?? 'Signed up directly'
    byCompany.set(k, [...(byCompany.get(k) ?? []), h])
  }
  const cities = new Map<string, number>()
  for (const h of hired) if (!h.workRemote && h.workCity && h.workState) cities.set(`${h.workCity}, ${h.workState}`, (cities.get(`${h.workCity}, ${h.workState}`) ?? 0) + 1)
  return {
    settings,
    areaFound: !!area,
    split: splitByPlace(hired, area),
    companies: [...byCompany.entries()].map(([name, rows]) => ({ name, split: splitByPlace(rows, area) })).sort((a, b) => b.split.total - a.split.total),
    cities: [...cities.entries()].filter(([, n]) => n >= MIN_CELL_SIZE).sort((a, b) => b[1] - a[1]).slice(0, 12),
    hiddenCities: [...cities.values()].filter((n) => n < MIN_CELL_SIZE).length,
  }
}
