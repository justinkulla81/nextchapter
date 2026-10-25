import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { boardCountyKeys, visibleBoards } from '@/lib/workforce/board-area'
import { boardLabor, type BoardLabor } from '@/lib/workforce/labor'
import { orgSlug } from '@/lib/crm/org-slug'
import { COLLEGE_SECTORS, COLLEGE_SIZES } from '@/lib/workforce/board-area'
import { TWELVE_MONTHS_MS, getPublicNotices } from '@/lib/warn/layoff-pages'

// Public pages for workforce boards, American Job Centers and colleges, built from tables we already hold
// (CareerOneStop boards and centers, IPEDS colleges, BLS county labor, the WARN record). Only facts a public
// agency or the Department of Education publishes: no director or chair names, emails or phone numbers.

export { COLLEGE_SECTORS, COLLEGE_SIZES }

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export interface PublicBoard {
  id: string
  slug: string
  state: string
  name: string
  website: string | null
  zip: string | null
  serviceArea: string | null
  statewide: boolean
  counties: string[]
  placeCounties: string[]
}

export interface PublicCenter {
  id: string
  name: string
  kind: string | null
  city: string | null
  phone: string | null
  hours: string | null
  detailsUrl: string | null
  boardId: string | null
}

export interface PublicCollege {
  id: string
  name: string
  city: string | null
  sector: number | null
  size: number | null
  website: string | null
  /** /prepared/<slug> when the college has a claimable organization in the CRM. */
  claimSlug: string | null
}

/** A board's page slug: its name, with the id added only when two boards in a state share a name. */
export function boardSlugs(boards: { id: string; name: string }[]): Map<string, string> {
  const count = new Map<string, number>()
  for (const b of boards) count.set(slugify(b.name), (count.get(slugify(b.name)) ?? 0) + 1)
  return new Map(boards.map((b) => [b.id, (count.get(slugify(b.name)) ?? 0) > 1 ? `${slugify(b.name)}-${slugify(b.id)}` : slugify(b.name)]))
}

export const getStateBoards = cache(async (state: string): Promise<PublicBoard[]> => {
  const rows = await prisma.workforceBoard.findMany({
    where: { state },
    select: { id: true, state: true, name: true, website: true, zip: true, serviceArea: true, statewide: true, counties: true, placeCounties: true },
    orderBy: { name: 'asc' },
  })
  const shown = visibleBoards(rows)
  const slugs = boardSlugs(shown)
  return shown.map((b) => ({ ...b, slug: slugs.get(b.id)! }))
})

export const getStateCenters = cache(async (state: string): Promise<PublicCenter[]> => {
  const rows = await prisma.americanJobCenter.findMany({
    where: { state },
    select: { id: true, name: true, centerType: true, city: true, phone: true, hours: true, detailsUrl: true, workforceBoardId: true },
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
  })
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.centerType, city: r.city, phone: r.phone, hours: r.hours, detailsUrl: r.detailsUrl, boardId: r.workforceBoardId }))
})

const keyOf = (k: string) => k.replace(/\s+/g, '')

export async function getBoardLabor(b: PublicBoard): Promise<BoardLabor | null> {
  const keys = boardCountyKeys(b)
  const rows = await prisma.countyLabor.findMany({ where: { state: b.state }, select: { nameKey: true, laborForce: true, unemployed: true, rateYearAgo: true, period: true } })
  const mine = keys === 'all' ? rows : rows.filter((r) => keys.includes(keyOf(r.nameKey)))
  return boardLabor(mine)
}

export const getStateLabor = cache(async (state: string): Promise<BoardLabor | null> => {
  const rows = await prisma.countyLabor.findMany({ where: { state }, select: { laborForce: true, unemployed: true, rateYearAgo: true, period: true } })
  return boardLabor(rows)
})

/** Colleges in a state from the IPEDS directory, with the claim slug for those linked to a CRM organization. */
export const getStateColleges = cache(async (state: string): Promise<PublicCollege[]> => {
  const rows = await prisma.localCollege.findMany({
    where: { state, sector: { in: [1, 2, 4, 5] } },
    select: { id: true, name: true, city: true, sector: true, size: true, website: true, crmOrgId: true },
    orderBy: { name: 'asc' },
  })
  const orgIds = rows.map((r) => r.crmOrgId).filter((x): x is string => !!x)
  const orgs = orgIds.length
    ? await prisma.crmOrganization.findMany({ where: { id: { in: orgIds } }, select: { id: true, canonicalNameNormalized: true } })
    : []
  const slugByOrg = new Map(orgs.map((o) => [o.id, orgSlug(o.canonicalNameNormalized)]))
  return rows.map((r) => ({
    id: r.id, name: r.name, city: r.city, sector: r.sector, size: r.size, website: r.website,
    claimSlug: r.crmOrgId ? (slugByOrg.get(r.crmOrgId) ?? null) : null,
  }))
})

export interface StateLayoffs { notices: number; workers: number; employers: number }

export async function getStateLayoffs(state: string): Promise<StateLayoffs> {
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const recent = (await getPublicNotices()).filter((n) => n.state === state && n.noticeDate.getTime() >= cutoff)
  return { notices: recent.length, workers: recent.reduce((s, n) => s + (n.workers ?? 0), 0), employers: new Set(recent.map((n) => n.slug)).size }
}

/** States that have at least one board, for the hub and the sitemap. */
export const getStatesWithBoards = cache(async (): Promise<{ state: string; boards: number; centers: number }[]> => {
  const [boards, centers] = await Promise.all([
    prisma.workforceBoard.groupBy({ by: ['state'], _count: { _all: true } }),
    prisma.americanJobCenter.groupBy({ by: ['state'], _count: { _all: true } }),
  ])
  const c = new Map(centers.map((x) => [x.state, x._count._all]))
  return boards.map((b) => ({ state: b.state, boards: b._count._all, centers: c.get(b.state) ?? 0 }))
})

export const rateText = (l: BoardLabor) => `${l.rate.toFixed(1)}%`
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function periodLabel(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p)
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : p
}
