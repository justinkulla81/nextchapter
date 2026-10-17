import 'server-only'
import { prisma } from '@/lib/prisma'
import { recommendFirms, type FirmForRecommend, type RecommendedFirm } from './recommend'

// The firm list changes weekly (ncrawl sync), so one in-process copy for an
// hour is plenty; ~1,300 small rows.
let firmCache: { at: number; rows: FirmForRecommend[] } | null = null
const FIRM_CACHE_MS = 60 * 60 * 1000

async function loadFirms(): Promise<FirmForRecommend[]> {
  if (firmCache && Date.now() - firmCache.at < FIRM_CACHE_MS) return firmCache.rows
  const rows = await prisma.searchFirm.findMany({
    select: {
      id: true,
      name: true,
      website: true,
      domain: true,
      segment: true,
      liveSearchCount: true,
      sampleTitles: true,
      teamPageUrl: true,
      crmOrg: { select: { industry: true, focus: true } },
    },
  })
  const firms = rows.map(({ crmOrg, ...f }) => ({ ...f, orgIndustry: crmOrg?.industry ?? null, orgFocus: crmOrg?.focus ?? null }))
  firmCache = { at: Date.now(), rows: firms }
  return firms
}

export async function recommendFirmsForCandidate(candidateId: string, limit = 12): Promise<RecommendedFirm[]> {
  const [profile, firms] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        primaryFunction: true,
        secondaryFunction: true,
        targetFunction: true,
        industryContext: true,
        secondaryIndustryContext: true,
        targetIndustries: true,
        highestLevelReached: true,
      },
    }),
    loadFirms(),
  ])
  return recommendFirms(
    {
      functions: [profile.targetFunction, profile.primaryFunction, profile.secondaryFunction],
      industries: [profile.industryContext, profile.secondaryIndustryContext, ...profile.targetIndustries],
      level: profile.highestLevelReached,
    },
    firms,
    limit
  )
}
