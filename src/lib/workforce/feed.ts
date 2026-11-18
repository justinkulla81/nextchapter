import 'server-only'
// The partner feed (Workforce Hub and Partner Hub): what is happening that a region's partners should see, in one list. Four kinds:
// layoffs (the region's, and the largest filed nationally), funding (federal notices closing soon and the organization's own deadlines),
// rankings (where the region's main city places) and data (the region's unemployment rate). Every read is narrow and bounded, and the
// whole feed is shared for 30 minutes per organization.

import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { readProfile } from '@/lib/higher-ed/profile'
import { federalGrants } from '@/lib/higher-ed/grants'
import { readLocal } from '@/lib/workforce/local'
import { getAwards, readRankingIndex } from '@/lib/rankings/store'
import { groupByMonth, viewAwards } from '@/lib/rankings/awards'
import { cityAwardKeys } from '@/lib/rankings/place-keys'

export type FeedKind = 'layoff' | 'funding' | 'ranking' | 'data'
export type FeedItem = { kind: FeedKind; scope: 'region' | 'national'; title: string; detail: string | null; date: string | null; href: string | null }

const DAY = 86_400_000
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export const loadFeed = memoTtl(30 * 60_000, (institutionId: string) => institutionId, async (institutionId: string): Promise<FeedItem[]> => {
  const now = Date.now()
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { profile: true, enabledFeatures: true } })
  const profile = readProfile(inst.profile)
  const local = readLocal(inst.enabledFeatures)
  const [regional, national, federal, due, awards, index] = await Promise.all([
    regionNotices(institutionId).catch(() => []),
    prisma.warnNotice.findMany({ where: { dismissedAt: null, noticeDate: { gte: new Date(now - 21 * DAY) }, employees: { not: null } }, orderBy: { employees: 'desc' }, take: 4, select: { employer: true, state: true, noticeDate: true, employees: true, sourceUrl: true } }).catch(() => []),
    federalGrants().catch(() => null),
    prisma.fundingApplication.findMany({ where: { institutionId, status: { in: ['CONSIDERING', 'DRAFTING'] }, dueDate: { gte: new Date(now), lte: new Date(now + 60 * DAY) } }, orderBy: { dueDate: 'asc' }, take: 3, select: { name: true, funder: true, dueDate: true } }).catch(() => []),
    local ? getAwards(cityAwardKeys(local.anchorCity, local.anchorState)).catch(() => []) : Promise.resolve([]),
    local ? readRankingIndex().catch(() => []) : Promise.resolve([]),
  ])
  const out: FeedItem[] = []
  for (const n of regional.slice(0, 4)) out.push({ kind: 'layoff', scope: 'region', title: `${n.employer} filed a layoff notice`, detail: [n.employees ? `${n.employees.toLocaleString('en-US')} workers` : null, n.county ? `${n.county} County` : n.state].filter(Boolean).join(' · '), date: iso(n.noticeDate), href: n.sourceUrl ?? null })
  for (const n of national) out.push({ kind: 'layoff', scope: 'national', title: `${n.employer} filed a layoff notice`, detail: [n.employees ? `${n.employees.toLocaleString('en-US')} workers` : null, n.state].filter(Boolean).join(' · '), date: iso(n.noticeDate), href: n.sourceUrl ?? null })
  for (const d of due) out.push({ kind: 'funding', scope: 'region', title: `Your deadline: ${d.name}`, detail: d.funder ? `From ${d.funder}` : null, date: iso(d.dueDate), href: null })
  const soon = (federal?.grants ?? []).filter((g) => g.closeDate && new Date(g.closeDate).getTime() >= now && new Date(g.closeDate).getTime() <= now + 45 * DAY).sort((a, b) => String(a.closeDate).localeCompare(String(b.closeDate))).slice(0, 4)
  for (const g of soon) out.push({ kind: 'funding', scope: 'national', title: g.title, detail: `${g.agency} · closes ${g.closeDate}`, date: g.closeDate, href: g.url })
  const latest = groupByMonth(viewAwards(awards, index))[0]
  if (local && latest) for (const a of latest.items.slice(0, 3)) out.push({ kind: 'ranking', scope: 'national', title: `${local.anchorCity} is #${a.rank} of ${a.places}: ${a.title}`, detail: `${latest.month}, NextChapter rankings of U.S. cities`, date: null, href: a.href })
  const u = profile.region?.unemployment?.[0]
  if (u) out.push({ kind: 'data', scope: 'region', title: `${u.area}: unemployment ${u.rate}%`, detail: `${u.period}. Source: ${u.source}`, date: null, href: u.sourceUrl ?? null })
  return out
})

export const FEED_SECTIONS: { kind: FeedKind; title: string }[] = [
  { kind: 'layoff', title: 'Layoffs' },
  { kind: 'funding', title: 'Funding' },
  { kind: 'ranking', title: 'Rankings' },
  { kind: 'data', title: 'Data' },
]
