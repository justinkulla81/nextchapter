import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { awardIsWorkforce } from '@/lib/bids/relevance'
import type { Profile } from './profile'
import type { EvalContext, Partner, PastWinner } from './evaluate'

/**
 * Who has won at this buyer, who could be our prime or partner, and how warm we are with the issuer.
 * Every read is bounded (take ≤ 12) and narrow; the competitor name list is held 6 hours per instance.
 */

const competitorNames = memoTtl(6 * 3_600_000, () => 'all', async () =>
  prisma.productCompetitor.findMany({
    where: { relationship: { in: ['DIRECT', 'ADJACENT'] } },
    select: { name: true },
    take: 1000,
  }).then((r) => r.map((c) => c.name).filter((n) => n.length >= 4)),
)

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/** Known competitors whose name appears in the document text (word boundary, case-insensitive). */
export function namesInText(names: string[], text: string): string[] {
  return names.filter((n) => new RegExp(`\\b${escapeRe(n)}\\b`, 'i').test(text)).slice(0, 10)
}

async function pastWinners(issuerOrgId: string | null, issuer: string | null): Promise<PastWinner[]> {
  const or = [
    ...(issuerOrgId ? [{ buyerOrgId: issuerOrgId }] : []),
    ...(issuer && issuer.length >= 6 ? [{ agency: { contains: issuer, mode: 'insensitive' as const } }, { subAgency: { contains: issuer, mode: 'insensitive' as const } }] : []),
  ]
  if (!or.length) return []
  const rows = await prisma.competitorAward.findMany({
    where: { OR: or },
    select: { competitorName: true, recipientName: true, description: true, agency: true, amount: true, startDate: true },
    orderBy: { startDate: 'desc' },
    take: 12,
  })
  return rows.filter((r) => awardIsWorkforce(r)).map((r) => ({
    name: r.competitorName,
    detail: `${(r.description ?? '').slice(0, 140)}${r.startDate ? ` (${r.startDate.toISOString().slice(0, 4)})` : ''}`,
    amount: r.amount || null,
    isCompetitor: true,
  }))
}

async function warmAt(orgId: string | null): Promise<number> {
  if (!orgId) return 0
  return prisma.crmAffiliation.count({ where: { orgId, isCurrent: true, person: { warmth: { in: ['HOT', 'WARM'] } } } })
}

/** Organizations that could lead an application we sit inside: colleges for a college-only grant, otherwise boards and non-profits in the state. */
async function partners(p: Profile): Promise<Partner[]> {
  const state = p.state?.toUpperCase() ?? null
  const needs = p.whoCanApply.collegesOnly ? ['UNIVERSITY'] as const
    : p.whoCanApply.applicantTypes.some((t) => /college|universit|higher/i.test(t)) ? ['UNIVERSITY', 'GOVERNMENT', 'NONPROFIT'] as const
      : ['GOVERNMENT', 'NONPROFIT'] as const
  const orgs = state
    ? await prisma.crmOrganization.findMany({
      where: { usState: state, orgTypes: { hasSome: [...needs] } },
      select: { id: true, name: true, orgTypes: true, _count: { select: { affiliations: { where: { isCurrent: true, person: { warmth: { in: ['HOT', 'WARM'] } } } } } } },
      orderBy: { priorityScore: 'desc' },
      take: 12,
    })
    : []
  const out: Partner[] = orgs
    .sort((a, b) => b._count.affiliations - a._count.affiliations)
    .slice(0, 8)
    .map((o) => ({ name: o.name, orgId: o.id, warm: o._count.affiliations > 0, why: `${o.orgTypes.map((t) => t.toLowerCase()).join(', ')} in ${state}${o._count.affiliations ? `, ${o._count.affiliations} warm contact(s)` : ''}` }))
  if (state && !p.whoCanApply.collegesOnly && out.length < 8) {
    const boards = await prisma.workforceBoard.findMany({ where: { state }, select: { name: true, knownAs: true, directorName: true }, take: 8 - out.length })
    for (const b of boards) out.push({ name: b.knownAs ?? b.name, orgId: null, warm: false, why: `Workforce board in ${state}${b.directorName ? `; director ${b.directorName}` : ''}` })
  }
  for (const e of p.subcontracting.expectedPrimes.slice(0, 3)) out.unshift({ name: e, orgId: null, warm: false, why: 'Named in the document as the expected lead.' })
  return out
}

export async function loadContext(p: Profile, text: string, issuerOrgId: string | null): Promise<EvalContext> {
  const [winners, warm, names, parts] = await Promise.all([
    pastWinners(issuerOrgId, p.issuer).catch(() => []),
    warmAt(issuerOrgId).catch(() => 0),
    competitorNames().catch(() => [] as string[]),
    partners(p).catch(() => []),
  ])
  const named = p.incumbentsOrPastWinners.map((n) => ({ name: n, detail: 'Named in the document', amount: null, isCompetitor: names.some((c) => c.toLowerCase() === n.toLowerCase()) }))
  return { pastWinners: [...named, ...winners], partners: parts, warmContactsAtIssuer: warm, competitorsInText: namesInText(names, text) }
}
