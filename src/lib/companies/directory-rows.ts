import 'server-only'
import type { CompanySizeBand, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadBulkCompanyRows } from '@/lib/companies/company-ranking-data'

export interface DirectoryRow {
  id: string
  name: string
  canonicalNameNormalized: string
  industry: string | null
  sizeBand: CompanySizeBand | null
  hqMetro: string | null
  signals: { trajectory: string; openRolesTotal: number; weekStartDate: Date }[]
  _count: { memberEmployment: number }
}

const DIRECTORY_SELECT = {
  id: true,
  name: true,
  canonicalNameNormalized: true,
  industry: true,
  sizeBand: true,
  hqMetro: true,
  signals: { orderBy: { weekStartDate: 'desc' }, take: 1, select: { trajectory: true, openRolesTotal: true, weekStartDate: true } },
  _count: { select: { memberEmployment: true } },
} satisfies Prisma.CompanySelect

// Companies and their member counts are the same for every viewer (nothing
// here reads the signed-in member), so the two full-table reads below are
// memoised in-process for a few minutes, matching the bulk company cache the
// ranking uses. Best-effort: a cold instance just recomputes.
const DIRECTORY_TTL_MS = 10 * 60 * 1000

function memoised<T>(load: () => Promise<T>): () => Promise<T> {
  let entry: { at: number; value: Promise<T> } | null = null
  return () => {
    if (!entry || Date.now() - entry.at > DIRECTORY_TTL_MS) {
      const value = load()
      const mine = { at: Date.now(), value }
      entry = mine
      // A failed read must not poison the cache for ten minutes.
      value.catch(() => {
        if (entry === mine) entry = null
      })
    }
    return entry.value
  }
}

const loadAllOrderedIds = memoised(() =>
  prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true } }).then((rows) => rows.map((r) => r.id))
)
const loadMemberCounts = memoised(() =>
  prisma.memberEmployment
    .groupBy({ by: ['companyId'], _count: { _all: true } })
    .then((rows) => new Map(rows.map((m) => [m.companyId, m._count._all])))
)

function queryDirectoryRows(nameWhere: Prisma.CompanyWhereInput): Promise<DirectoryRow[]> {
  return prisma.company.findMany({ where: nameWhere, orderBy: { name: 'asc' }, select: DIRECTORY_SELECT })
}

// One page of the A–Z directory, ordered, counted and cut by the database —
// for views that need no signals, ranking or per-viewer filtering.
export async function loadDirectoryPage(
  nameWhere: Prisma.CompanyWhereInput,
  skip: number,
  take: number
): Promise<{ rows: DirectoryRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.company.findMany({ where: nameWhere, orderBy: { name: 'asc' }, skip, take, select: DIRECTORY_SELECT }),
    prisma.company.count({ where: nameWhere }),
  ])
  return { rows, total }
}

// Every matching row in A–Z order. The heavy part (every company with its
// newest signal) comes from the in-process bulk cache the ranking already
// uses; the ordered id list (so the database's own name ordering is kept
// exactly) and member counts are cached too when there is no name query.
// Falls back to the direct query if the cache lacks a row.
export async function loadDirectoryRows(nameWhere: Prisma.CompanyWhereInput, useBulk: boolean): Promise<DirectoryRow[]> {
  if (!useBulk) return queryDirectoryRows(nameWhere)
  const hasQuery = Object.keys(nameWhere).length > 0
  const [ids, countById, bulk] = await Promise.all([
    hasQuery
      ? prisma.company.findMany({ where: nameWhere, orderBy: { name: 'asc' }, select: { id: true } }).then((rows) => rows.map((r) => r.id))
      : loadAllOrderedIds(),
    loadMemberCounts(),
    loadBulkCompanyRows(),
  ])
  const byId = new Map(bulk.map((c) => [c.id, c]))
  const rows: DirectoryRow[] = []
  for (const id of ids) {
    const c = byId.get(id)
    if (!c) return queryDirectoryRows(nameWhere)
    rows.push({
      id: c.id,
      name: c.name,
      canonicalNameNormalized: c.canonicalNameNormalized,
      industry: c.industry,
      sizeBand: c.sizeBand,
      hqMetro: c.hqMetro,
      signals: c.signals.map((s) => ({
        trajectory: s.trajectory,
        openRolesTotal: s.openRolesTotal,
        weekStartDate: s.weekStartDate,
      })),
      _count: { memberEmployment: countById.get(c.id) ?? 0 },
    })
  }
  return rows
}
