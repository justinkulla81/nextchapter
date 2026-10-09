import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import { getIndustryTrends } from '@/lib/market/bls-industry-trends'
import { getLocalEconomy, type LocalEconomy } from '@/lib/companies/local-economy'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { getCandidateContactCountsByCompany } from '@/lib/companies/candidate-contacts-at-company'
import type { NamedPosting, RankingCandidate, RankingCompany } from '@/lib/companies/company-ranking'

// Loads everything company-ranking.ts scores, for one viewing candidate, in a
// fixed number of bulk queries (no per-company round trips) — the Company
// table is low hundreds of rows, so we fetch it whole and group in memory,
// same approach as signals.ts and the existing Companies index.
//
// NO metered calls: nothing here resolves industry/size/description (the
// lazy LLM resolvers in company-lookup.ts) — those stay a once-per-company,
// on-open cost. A company without them ranks on neutral credit.

const DAY_MS = 24 * 60 * 60 * 1000
const SIGNAL_FRESH_MS = 8 * 7 * DAY_MS // same recency bar as the Companies index filters
const WARN_WINDOW_MS = 365 * DAY_MS

function cityOf(location: string | null): string | null {
  if (!location) return null
  return location.split(',')[0]?.trim() || null
}

// The non-personal half of the load (every company, every live posting, every
// layoff notice, every insider-eligible employment row) is identical for all
// viewers, and it is the slow part (~1.5s). The dashboard nav badge needs it
// on every page, so it is memoised in-process for a few minutes. Per-viewer
// visibility (what is nameable to THIS member) is applied afterwards, never
// baked into the cache. Best-effort only: a cold instance just recomputes.
const BULK_TTL_MS = 10 * 60 * 1000
let bulkCache: { at: number; data: ReturnType<typeof fetchBulk> } | null = null

function fetchBulk() {
  const now = Date.now()
  return Promise.all([
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        canonicalNameNormalized: true,
        industry: true,
        sizeBand: true,
        hqMetro: true,
        signals: { orderBy: { weekStartDate: 'desc' }, take: 1, select: { trajectory: true, weekStartDate: true, openRolesTotal: true, rolesDelta12wk: true } },
      },
    }),
    prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        title: true,
        companyName: true,
        location: true,
        targetRemotePolicy: true,
        audienceTier: true,
        source: true,
        distribution: true,
        disclosure: true,
        postingType: true,
        submittedByRecruiterId: true,
        createdAt: true,
      },
    }),
    prisma.warnNotice.findMany({
      where: {
        companyId: { not: null },
        OR: [
          { noticeDate: { gte: new Date(now - WARN_WINDOW_MS) } },
          { noticeDate: null, fetchedAt: { gte: new Date(now - WARN_WINDOW_MS) } },
        ],
      },
      select: { companyId: true, employees: true, noticeDate: true, fetchedAt: true, industry: true },
    }),
    // Same privacy gates as getInsidersForCompany except the viewer exclusion,
    // which is applied per viewer below: never a member who opted out of being
    // an insider, never a Confidential Search Mode member.
    prisma.memberEmployment.findMany({
      where: { visibleAsInsider: true, candidate: { confidentialSearchMode: false } },
      select: { candidateId: true, companyId: true, function: true },
    }),
  ])
}

function loadBulk() {
  if (!bulkCache || Date.now() - bulkCache.at > BULK_TTL_MS) {
    const data = fetchBulk()
    bulkCache = { at: Date.now(), data }
    // A failed fetch must not poison the cache for ten minutes.
    data.catch(() => {
      if (bulkCache?.data === data) bulkCache = null
    })
  }
  return bulkCache.data
}

export async function loadCompanyRankingData(
  candidateId: string,
  opts: { includeContacts?: boolean } = {}
): Promise<{
  candidate: RankingCandidate
  companies: RankingCompany[]
  isCandidatePlus: boolean
  localEconomy: LocalEconomy | null
}> {
  const { includeContacts = true } = opts
  const now = Date.now()

  const [profile, plusStatus, [companyRows, postings, warnRows, allMemberRows], watchlist] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        primaryFunction: true,
        secondaryFunction: true,
        highestLevelReached: true,
        levelRankScore: true,
        metroArea: true,
        currentCity: true,
        currentState: true,
        openToRelocation: true,
        remotePreference: true,
        industryContext: true,
        secondaryIndustryContext: true,
        targetIndustries: true,
        targetCompanySize: true,
      },
    }),
    isDossierUnlocked(candidateId),
    loadBulk(),
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, select: { companyNameNormalized: true } }),
  ])

  const isCandidatePlus = plusStatus.unlocked
  const metroArea = profile.metroArea ?? normalizeMetroArea(profile.currentCity)
  const [industryTrends, localEconomy] = await Promise.all([
    getIndustryTrends(),
    getLocalEconomy(metroArea, profile.currentState).catch((e) => {
      console.error('Local economy lookup failed', e)
      return null
    }),
  ])
  const memberRows = allMemberRows.filter((m) => m.candidateId !== candidateId)

  // ── postings → per-company named list + anonymous hidden count ──────────
  const named = new Map<string, NamedPosting[]>()
  const latestNamedAt = new Map<string, number>()
  const hidden = new Map<string, number>()
  for (const p of postings) {
    const key = normalizeOrgName(p.companyName)
    if (!key) continue
    // A listing is nameable to THIS viewer only if the company is disclosed,
    // it is in the open browse feed, and (if Candidate+-only) they are
    // Candidate+. Anything else — confidential, private-pipeline (EXCLUDED),
    // targeted-to-someone-else, or locked — contributes to the anonymous
    // hidden count and never surfaces as a title, badge, or reason.
    const nameable =
      p.disclosure === 'OPEN' && p.distribution === 'OPEN' && !isBoardPostingLockedForViewer(p, isCandidatePlus)
    if (!nameable) {
      hidden.set(key, (hidden.get(key) ?? 0) + 1)
      continue
    }
    // Newest NAMEABLE posting only — what drives "new" markers, so a hidden
    // (confidential / exclusive) listing can never make a row light up.
    latestNamedAt.set(key, Math.max(latestNamedAt.get(key) ?? 0, p.createdAt.getTime()))
    const list = named.get(key) ?? []
    list.push({
      title: p.title,
      function: inferFunctionFromTitle(p.title),
      level: inferLevelFromTitle(p.title),
      metro: normalizeMetroArea(cityOf(p.location)),
      isRemote: /remote/i.test(p.location ?? '') || p.targetRemotePolicy === 'remote',
      isRecruiterMandate: p.submittedByRecruiterId !== null || p.postingType === 'recruiter_search',
    })
    named.set(key, list)
  }

  // ── WARN → per-company ──────────────────────────────────────────────────
  const warnByCompany = new Map<string, { filings12mo: number; employeesAffected: number; daysSinceMostRecent: number }>()
  // A filed WARN notice carries the employer's NAICS sector as published —
  // real, free industry data for the many companies whose own industry has
  // not been resolved yet (only resolved on-open, see company-lookup.ts). Used
  // only as a fallback, newest notice wins.
  const warnIndustryByCompany = new Map<string, { industry: string; when: number }>()
  for (const w of warnRows) {
    if (!w.companyId) continue
    const when = (w.noticeDate ?? w.fetchedAt).getTime()
    const days = Math.max(0, Math.floor((now - when) / DAY_MS))
    if (w.industry) {
      const seen = warnIndustryByCompany.get(w.companyId)
      if (!seen || when > seen.when) warnIndustryByCompany.set(w.companyId, { industry: w.industry, when })
    }
    const cur = warnByCompany.get(w.companyId)
    warnByCompany.set(w.companyId, {
      filings12mo: (cur?.filings12mo ?? 0) + 1,
      employeesAffected: (cur?.employeesAffected ?? 0) + (w.employees ?? 0),
      daysSinceMostRecent: cur ? Math.min(cur.daysSinceMostRecent, days) : days,
    })
  }

  // ── NC members who worked there ─────────────────────────────────────────
  const formerByCompany = new Map<string, { total: number; sameFunction: number }>()
  for (const m of memberRows) {
    const cur = formerByCompany.get(m.companyId) ?? { total: 0, sameFunction: 0 }
    cur.total += 1
    if (m.function && m.function === profile.primaryFunction) cur.sameFunction += 1
    formerByCompany.set(m.companyId, cur)
  }

  const contactCounts = includeContacts
    ? await getCandidateContactCountsByCompany(
        candidateId,
        companyRows.map((c) => c.name)
      )
    : new Map<string, number>()
  const watched = new Set(watchlist.map((w) => w.companyNameNormalized))

  // Platform-wide growth in open roles over the signal's 12-week window. A bulk
  // crawler import makes the stored per-company trajectory read "growing" for
  // nearly everyone (their count 12 weeks ago predates the import), which would
  // hand every company the same hiring points. When the whole platform grew by
  // more than a quarter, judge each company against that baseline instead.
  let totalNow = 0
  let totalPast = 0
  for (const c of companyRows) {
    const sig = c.signals[0]
    if (!sig || now - sig.weekStartDate.getTime() > SIGNAL_FRESH_MS) continue
    const past = sig.openRolesTotal - sig.rolesDelta12wk
    if (past > 0) {
      totalNow += sig.openRolesTotal
      totalPast += past
    }
  }
  const platformGrowth = totalPast > 0 ? totalNow / totalPast : 1
  const platformRamp = platformGrowth > 1.25

  const companies: RankingCompany[] = companyRows.map((c) => {
    const signal = c.signals[0]
    const fresh = signal && now - signal.weekStartDate.getTime() <= SIGNAL_FRESH_MS
    let trajectory: 'growing' | 'flat' | 'contracting' | null =
      fresh && ['growing', 'flat', 'contracting'].includes(signal.trajectory)
        ? (signal.trajectory as 'growing' | 'flat' | 'contracting')
        : null
    if (fresh && platformRamp) {
      const past = signal.openRolesTotal - signal.rolesDelta12wk
      // No past count means a company that appeared with the import: new to us,
      // not necessarily new to hiring — no verdict.
      if (past <= 0) trajectory = null
      else {
        const ratio = signal.openRolesTotal / past
        trajectory = ratio >= platformGrowth * 1.15 ? 'growing' : ratio <= platformGrowth * 0.85 ? 'contracting' : 'flat'
      }
    }
    const industryText = c.industry ?? warnIndustryByCompany.get(c.id)?.industry ?? null
    const industryBucket = industryText ? (industryTrends[industryText] ? industryText : normalizeIndustryBucket(industryText)) : null
    const former = formerByCompany.get(c.id)
    return {
      id: c.id,
      name: c.name,
      canonicalNameNormalized: c.canonicalNameNormalized,
      industry: c.industry ?? warnIndustryByCompany.get(c.id)?.industry ?? null,
      sizeBand: c.sizeBand,
      hqMetro: c.hqMetro,
      trajectory,
      signalOpenRoles: fresh ? signal.openRolesTotal : null,
      latestPostingAt: latestNamedAt.get(c.canonicalNameNormalized) ?? null,
      industryYoyPct: industryBucket ? (industryTrends[industryBucket]?.yoyPct ?? null) : null,
      postings: named.get(c.canonicalNameNormalized) ?? [],
      hiddenPostings: hidden.get(c.canonicalNameNormalized) ?? 0,
      warn: warnByCompany.get(c.id) ?? null,
      myContactCount: contactCounts.get(c.name) ?? 0,
      memberFormerCount: former?.total ?? 0,
      memberSameFunctionCount: former?.sameFunction ?? 0,
      onWatchlist: watched.has(c.canonicalNameNormalized),
    }
  })

  const candidate: RankingCandidate = {
    primaryFunction: profile.primaryFunction,
    secondaryFunction: profile.secondaryFunction,
    highestLevelReached: profile.highestLevelReached,
    levelRankScore: profile.levelRankScore,
    metroArea,
    openToRelocation: profile.openToRelocation,
    remotePreference: profile.remotePreference,
    industries: [profile.industryContext, profile.secondaryIndustryContext, ...profile.targetIndustries].filter(
      (s): s is string => !!s
    ),
    targetCompanySize: profile.targetCompanySize,
    localStress: localEconomy?.stress ?? 0,
  }

  return { candidate, companies, isCandidatePlus, localEconomy }
}
