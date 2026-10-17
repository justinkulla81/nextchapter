import 'server-only'
import { prisma } from '@/lib/prisma'
import type { EmployerPayLevel, PayVsMarket } from '@/lib/pay/market-pay'
import { duplicateLine, jobLifecycle, lifecycleBadge, postingRepostLine } from '@/lib/jobs/job-status'
import { loadCompanyLifecycleStats, type CompanyLifecycleStats } from '@/lib/jobs/past-jobs-data'

// Read side of the company hiring index for the company pages (candidate, admin
// company, CRM organisation). Reads only Company-spine public facts —
// CompanyHiringProfile and CompanyJobOpening — so it is safe on both sides of the
// company wall. Openings never include exclusives, confidential searches or
// institution-scoped jobs (see CompanyJobOpening's schema comment).

export interface OpeningView {
  id: string
  title: string
  location: string | null
  url: string
  openedAt: string // posted date, else first seen (ISO)
  closedAt: string | null
  seniorityGroup: string | null
  function: string | null
  payMin: number | null
  payMax: number | null
  marketLow: number | null
  marketMid: number | null
  marketHigh: number | null
  marketBasis: string | null
  marketSample: number | null
  payVsMarket: PayVsMarket | null
  /** Past openings: "Closed" or "No longer listed" (job-status.ts); null while open. */
  closedLabel: string | null
  /** "Reposted · first seen …, N times" and "Also listed in N other places", when known. */
  repostLine: string | null
}

export interface HiringProfileView {
  industry: string | null
  siteType: 'single_site' | 'multi_site' | 'remote_only' | 'unknown'
  states: string[]
  topLocations: { location: string; count: number }[]
  remoteShare: number | null
  topFunctions: { function: string; count: number }[]
  levelMix: { group: string; count: number }[]
  directorPlusShare: number | null
  vpPlusShare: number | null
  openNow: number
  opened90d: number
  opened12mo: number
  totalSeen: number
  firstSeenAt: string | null
  warnFilings12mo: number
  warnEmployees12mo: number
  lastWarnAt: string | null
  layoffNews12mo: number
  payLevel: EmployerPayLevel
  payLevelSample: number
  payLevelRatio: number | null
  postedPayShare: number | null
  computedAt: string
}

export interface CompanyHiringIndex {
  profile: HiringProfileView | null
  open: OpeningView[]
  past: OpeningView[]
  openTotal: number
  pastTotal: number
  /** Counts by status, median days open, reposts; null when the read failed. */
  lifecycle: CompanyLifecycleStats | null
}

// Crawler industry keys, shown when the company has no directory industry yet.
const INDUSTRY_LABEL: Record<string, string> = {
  technology: 'Technology', healthcare: 'Healthcare', financial_services: 'Financial services', education: 'Education',
  industrial: 'Industrial', life_sciences: 'Life sciences', consumer: 'Consumer', nonprofit: 'Nonprofit',
  government: 'Government', energy: 'Energy', professional_services: 'Professional services', logistics: 'Logistics',
  real_estate: 'Real estate', media: 'Media', higher_education: 'Higher education', agriculture: 'Agriculture',
  association: 'Association', aerospace_defense: 'Aerospace & defense', telecom: 'Telecommunications',
}

export function industryLabel(raw: string | null): string | null {
  if (!raw) return null
  return INDUSTRY_LABEL[raw] ?? raw
}

const LIST_LIMIT = 100

const openingSelect = {
  id: true, title: true, location: true, url: true, postedAt: true, firstSeenAt: true, closedAt: true,
  seniorityGroup: true, function: true, payAnnualMin: true, payAnnualMax: true, marketPayLow: true,
  marketPayMid: true, marketPayHigh: true, marketPayBasis: true, marketPaySample: true, payVsMarket: true,
  closeReason: true, level: true,
} as const

type OpeningRow = {
  id: string; title: string; location: string | null; url: string; postedAt: Date | null; firstSeenAt: Date
  closedAt: Date | null; seniorityGroup: string | null; function: string | null; payAnnualMin: number | null
  payAnnualMax: number | null; marketPayLow: number | null; marketPayMid: number | null; marketPayHigh: number | null
  marketPayBasis: string | null; marketPaySample: number | null; payVsMarket: string | null
  closeReason: string | null; level: string | null
}

type RepostInfo = { repostCount: number | null; reopenCount: number | null; repostFirstSeenAt: Date | null; postedAt: Date | null; createdAt: Date; duplicateCount: number | null }

// The board posting behind each opening (same url) carries its repost / duplicate counts.
async function repostInfoByUrl(urls: string[]): Promise<Map<string, RepostInfo>> {
  if (urls.length === 0) return new Map()
  try {
    const rows = await prisma.exclusiveJobPosting.findMany({
      where: { url: { in: urls } },
      select: { url: true, repostCount: true, reopenCount: true, repostFirstSeenAt: true, postedAt: true, createdAt: true, duplicateCount: true },
    })
    return new Map(rows.map((r) => [r.url, r]))
  } catch (error) {
    console.error('hiring index: could not read repost counts', error)
    return new Map()
  }
}

function toView(o: OpeningRow, reposts: Map<string, RepostInfo>): OpeningView {
  const r = reposts.get(o.url)
  const closed = o.closedAt
    ? lifecycleBadge(jobLifecycle({ archivedAt: o.closedAt, closeReason: o.closeReason, postedAt: o.postedAt, createdAt: o.firstSeenAt, level: o.level ?? o.seniorityGroup }))
    : null
  const repostLine = r ? [postingRepostLine(r), o.closedAt ? null : duplicateLine(r.duplicateCount)].filter(Boolean).join(' · ') || null : null
  return {
    closedLabel: closed,
    repostLine,
    id: o.id,
    title: o.title,
    location: o.location,
    url: o.url,
    openedAt: (o.postedAt ?? o.firstSeenAt).toISOString(),
    closedAt: o.closedAt?.toISOString() ?? null,
    seniorityGroup: o.seniorityGroup,
    function: o.function,
    payMin: o.payAnnualMin,
    payMax: o.payAnnualMax,
    marketLow: o.marketPayLow,
    marketMid: o.marketPayMid,
    marketHigh: o.marketPayHigh,
    marketBasis: o.marketPayBasis,
    marketSample: o.marketPaySample,
    payVsMarket: (o.payVsMarket as PayVsMarket | null) ?? null,
  }
}

export async function loadCompanyHiringIndex(companyId: string): Promise<CompanyHiringIndex> {
  const [profile, open, past, openTotal, pastTotal, lifecycle] = await Promise.all([
    prisma.companyHiringProfile.findUnique({ where: { companyId } }),
    prisma.companyJobOpening.findMany({
      where: { companyId, closedAt: null },
      orderBy: [{ postedAt: { sort: 'desc', nulls: 'last' } }, { firstSeenAt: 'desc' }],
      take: LIST_LIMIT,
      select: openingSelect,
    }),
    prisma.companyJobOpening.findMany({
      // A collapsed duplicate (job-status.ts) is a current job shown through its primary copy.
      where: { companyId, closedAt: { not: null }, OR: [{ closeReason: null }, { closeReason: { not: 'duplicate' } }] },
      orderBy: { closedAt: 'desc' },
      take: LIST_LIMIT,
      select: openingSelect,
    }),
    prisma.companyJobOpening.count({ where: { companyId, closedAt: null } }),
    prisma.companyJobOpening.count({ where: { companyId, closedAt: { not: null }, OR: [{ closeReason: null }, { closeReason: { not: 'duplicate' } }] } }),
    loadCompanyLifecycleStats(companyId).catch((error) => {
      console.error('hiring index: lifecycle stats failed', companyId, error)
      return null
    }),
  ])
  const reposts = await repostInfoByUrl([...open, ...past].map((o) => o.url))
  return {
    profile: profile
      ? {
          industry: industryLabel(profile.industry),
          siteType: profile.siteType as HiringProfileView['siteType'],
          states: profile.states,
          topLocations: (profile.topLocations as HiringProfileView['topLocations'] | null) ?? [],
          remoteShare: profile.remoteShare,
          topFunctions: (profile.topFunctions as HiringProfileView['topFunctions'] | null) ?? [],
          levelMix: (profile.levelMix as HiringProfileView['levelMix'] | null) ?? [],
          directorPlusShare: profile.directorPlusShare,
          vpPlusShare: profile.vpPlusShare,
          openNow: profile.openNow,
          opened90d: profile.opened90d,
          opened12mo: profile.opened12mo,
          totalSeen: profile.totalSeen,
          firstSeenAt: profile.firstSeenAt?.toISOString() ?? null,
          warnFilings12mo: profile.warnFilings12mo,
          warnEmployees12mo: profile.warnEmployees12mo,
          lastWarnAt: profile.lastWarnAt?.toISOString() ?? null,
          layoffNews12mo: profile.layoffNews12mo,
          payLevel: profile.payLevel as EmployerPayLevel,
          payLevelSample: profile.payLevelSample,
          payLevelRatio: profile.payLevelRatio,
          postedPayShare: profile.postedPayShare,
          computedAt: profile.computedAt.toISOString(),
        }
      : null,
    open: open.map((o) => toView(o, reposts)),
    past: past.map((o) => toView(o, reposts)),
    openTotal,
    pastTotal,
    lifecycle,
  }
}
