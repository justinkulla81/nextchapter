import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { listOpenOpportunities } from '@/lib/funding-opportunities/store'
import { listOpenBoardBids } from '@/lib/bids/queries'
import { bidFitsUs } from '@/lib/bids/relevance'
import type { Facts } from './facts'

export type SourceKind = 'FEDERAL' | 'BOARD_BID' | 'CRM_GRANT'

export interface Candidate {
  sourceKind: SourceKind
  sourceId: string
  title: string
  url: string
  state: string | null
  issuer: string | null
  issuerOrgId: string | null
  dueAt: Date | null
}

export async function loadFacts(): Promise<Facts> {
  const rows = await prisma.bidCompanyFact.findMany({ select: { key: true, value: true }, take: 200 })
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function loadLibrary(): Promise<Record<string, string>> {
  const rows = await prisma.bidContentBlock.findMany({ select: { key: true, body: true }, take: 100 })
  return Object.fromEntries(rows.map((r) => [r.key, r.body]))
}

export async function saveFacts(values: Record<string, string>, by: string): Promise<string[]> {
  const current = await loadFacts()
  const changed: string[] = []
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim()
    if ((current[key] ?? '') === value) continue
    changed.push(key)
    if (!value) await prisma.bidCompanyFact.deleteMany({ where: { key } })
    else await prisma.bidCompanyFact.upsert({ where: { key }, create: { key, value, updatedBy: by }, update: { value, updatedBy: by } })
  }
  return changed
}

export async function saveLibraryBlock(key: string, body: string, by: string) {
  const v = body.trim()
  if (!v) await prisma.bidContentBlock.deleteMany({ where: { key } })
  else await prisma.bidContentBlock.upsert({ where: { key }, create: { key, body: v, updatedBy: by }, update: { body: v, updatedBy: by } })
}

/** A board-bid title that is plainly a form, answer sheet or template, not a solicitation. Saves a document read. */
const ATTACHMENT_TITLE = /budget (form|worksheet)|q\s*(&|and)\s*a\b|questions and answers|responses? to (rfp )?questions|template|inquiry period|final agency responses|pre-proposal conference .*\.(mp4|mov)|property ?inventory|application workbook/i

/** Open opportunities from all three pools, soonest due first. Bounded reads with narrow columns. */
export async function loadCandidates(now = new Date()): Promise<Candidate[]> {
  const [fed, bids, grants] = await Promise.all([
    listOpenOpportunities({ limit: 200, now }).catch(() => []),
    listOpenBoardBids({ now, limit: 300 }).catch(() => []),
    prisma.crmOpportunity.findMany({
      where: {
        pipeline: { key: 'grants' },
        outcome: 'OPEN',
        url: { not: null },
        deadlines: { some: { dueAt: { gte: now } } },
      },
      select: {
        id: true, title: true, url: true, orgId: true,
        org: { select: { name: true, usState: true } },
        deadlines: { where: { dueAt: { gte: now } }, select: { dueAt: true }, orderBy: { dueAt: 'asc' }, take: 1 },
      },
      take: 300,
    }).catch(() => []),
  ])
  const out: Candidate[] = [
    ...fed.map((o) => ({ sourceKind: 'FEDERAL' as const, sourceId: o.id, title: o.title, url: o.url, state: o.states.length === 1 ? o.states[0] : null, issuer: o.agency, issuerOrgId: o.orgId, dueAt: o.closesAt })),
    ...bids.filter((b) => bidFitsUs(b.title) && !ATTACHMENT_TITLE.test(b.title)).map((b) => ({ sourceKind: 'BOARD_BID' as const, sourceId: b.id, title: b.title, url: b.url, state: b.state || null, issuer: b.boardName, issuerOrgId: b.orgId, dueAt: b.deadline })),
    ...grants.map((g) => ({ sourceKind: 'CRM_GRANT' as const, sourceId: g.id, title: g.title, url: g.url!, state: g.org?.usState && g.org.usState.length === 2 ? g.org.usState : null, issuer: g.org?.name ?? null, issuerOrgId: g.orgId, dueAt: g.deadlines[0]?.dueAt ?? null })),
  ]
  return out.sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))
}

export async function findCandidate(kind: SourceKind, sourceId: string): Promise<Candidate | null> {
  if (kind === 'FEDERAL') {
    const o = (await listOpenOpportunities({ limit: 500 })).find((x) => x.id === sourceId)
    return o ? { sourceKind: kind, sourceId, title: o.title, url: o.url, state: o.states.length === 1 ? o.states[0] : null, issuer: o.agency, issuerOrgId: o.orgId, dueAt: o.closesAt } : null
  }
  if (kind === 'BOARD_BID') {
    const b = await prisma.boardBid.findUnique({ where: { id: sourceId }, select: { title: true, url: true, boardId: true, orgId: true, deadline: true } })
    if (!b) return null
    const board = await prisma.workforceBoard.findUnique({ where: { id: b.boardId }, select: { name: true, state: true } })
    return { sourceKind: kind, sourceId, title: b.title, url: b.url, state: board?.state ?? null, issuer: board?.name ?? null, issuerOrgId: b.orgId, dueAt: b.deadline }
  }
  const g = await prisma.crmOpportunity.findUnique({
    where: { id: sourceId },
    select: { title: true, url: true, orgId: true, org: { select: { name: true, usState: true } }, deadlines: { select: { dueAt: true }, orderBy: { dueAt: 'asc' }, take: 1 } },
  })
  if (!g?.url) return null
  return { sourceKind: kind, sourceId, title: g.title, url: g.url, state: g.org?.usState?.length === 2 ? g.org.usState : null, issuer: g.org?.name ?? null, issuerOrgId: g.orgId, dueAt: g.deadlines[0]?.dueAt ?? null }
}

export const evaluationId = (kind: SourceKind, sourceId: string) => `${kind.toLowerCase()}_${sourceId}`.replace(/[^a-zA-Z0-9_.-]/g, '-')

export async function evaluatedKeys(): Promise<Set<string>> {
  const rows = await prisma.bidEvaluation.findMany({ select: { sourceKind: true, sourceId: true }, take: 5000 })
  return new Set(rows.map((r) => `${r.sourceKind}:${r.sourceId}`))
}

export async function listEvaluations() {
  return prisma.bidEvaluation.findMany({
    select: { id: true, sourceKind: true, title: true, url: true, state: true, issuer: true, verdict: true, route: true, score: true, dueAt: true, evaluatedAt: true, fetchError: true, draftedAt: true, result: true },
    orderBy: [{ evaluatedAt: 'desc' }],
    take: 500,
  })
}

export async function getEvaluation(id: string) {
  return prisma.bidEvaluation.findUnique({ where: { id } })
}

export async function writeEvaluation(id: string, data: Omit<Prisma.BidEvaluationUncheckedCreateInput, 'id'>) {
  await prisma.bidEvaluation.upsert({ where: { id }, create: { id, ...data }, update: data })
}
