import 'server-only'
import { prisma } from '@/lib/prisma'
import { newReferralCode } from '@/lib/candidates/referral'
import { stateSlug } from '@/lib/seo/states'
import { getStateOrgList, resolveArea } from '@/lib/seo/org-pages'
import { stateName } from '@/lib/seo/states'
import { orgPagePath } from '@/lib/seo/org-page-rules'
import { resolveClaimableOrg } from '@/lib/org-claims/org'
import { BOARD_KIT_SOURCES, areaPhrase, boardKitLabel, parseBoardKitLabel, summarizeBoardKit, type BoardKitSource, type BoardKitStats } from './board-kit'

// Reads and writes for a workforce board's launch kit: its tracked links and what they brought in.

export interface BoardKitContext {
  boardId: string
  crmOrgId: string
  name: string
  state: string
  website: string | null
  /** The board's public page on this site, where the kit links land. */
  pagePath: string
  /** Where it serves, as it reads in a sentence. */
  area: string
  claimSlug: string
}

/** The workforce board a /prepared/<slug> address stands for, or null when the address is not a linked board. */
export async function boardKitContext(claimSlug: string): Promise<BoardKitContext | null> {
  try {
    const org = await resolveClaimableOrg(claimSlug)
    if (!org) return null
    const link = await prisma.publicOrgPage.findFirst({ where: { kind: 'WORKFORCE_BOARD', crmOrgId: org.id }, select: { sourceId: true, state: true } })
    if (!link) return null
    const list = await getStateOrgList('WORKFORCE_BOARD', stateSlug(link.state))
    const row = list?.rows.find((r) => r.id === link.sourceId || r.aliasIds?.includes(link.sourceId))
    if (!row) return null
    return { boardId: row.id, crmOrgId: org.id, name: row.name, state: row.state, website: row.website, pagePath: orgPagePath('WORKFORCE_BOARD', stateSlug(row.state), row.slug), area: areaPhrase(resolveArea(row, list!.stateData), stateName(row.state)), claimSlug }
  } catch {
    return null
  }
}

/** One active link per place for this board; returns the code for each. */
export async function ensureBoardKitLinks(boardId: string, createdBy: string | null): Promise<Record<BoardKitSource, string>> {
  const existing = await prisma.referralLink.findMany({ where: { label: { startsWith: `ob:${boardId}:` } }, select: { label: true, code: true } })
  const out = {} as Record<BoardKitSource, string>
  for (const { source } of BOARD_KIT_SOURCES) {
    const label = boardKitLabel(boardId, source)
    const found = existing.find((l) => l.label === label)
    out[source] = found
      ? found.code
      : (await prisma.referralLink.create({ data: { code: newReferralCode(), label, kind: 'OTHER', createdBy }, select: { code: true } })).code
  }
  return out
}

/** Clicks, and people who registered after a click, for each place. Joined counts under the floor come back as null. */
export async function boardKitStats(boardId: string): Promise<BoardKitStats> {
  const links = await prisma.referralLink.findMany({ where: { label: { startsWith: `ob:${boardId}:` } }, select: { id: true, label: true, clickCount: true } })
  const joins = await prisma.candidateReferral.groupBy({ by: ['referralLinkId'], where: { referralLinkId: { in: links.map((l) => l.id) } }, _count: { _all: true } })
  const byLink = new Map(joins.map((j) => [j.referralLinkId, j._count._all]))
  return summarizeBoardKit(
    links.flatMap((l) => {
      const parsed = parseBoardKitLabel(l.label)
      return parsed ? [{ source: parsed.source, clicks: l.clickCount, joined: byLink.get(l.id) ?? 0 }] : []
    }),
  )
}
