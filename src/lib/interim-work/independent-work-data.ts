import 'server-only'
import { InterimListingCategory } from '@prisma/client'
import type { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getInterimLaunchPlan } from '@/lib/gig-directory/interim-launch-plan'
import { getRelevantMarketplaceCategories } from '@/lib/interim-work/marketplace-tailoring'
import { isBoardReady } from '@/lib/interim-work/board-readiness'
import { getActiveListings, getSignedUpListingIds } from '@/lib/interim-work/listings'
import { computeMarketplaceSignupMix } from '@/lib/interim-work/marketplace-signup-mix'
import { isActiveMember } from '@/lib/membership/subscription'
import { getPlatformActivity, statusByListing } from '@/lib/platforms/candidate-view'
import { prisma } from '@/lib/prisma'
import type { WorkType } from '@/lib/jobs/work-type'

// Everything the independent-work toolkit shows, loaded once on the server. The independent-work part
// (components/dashboard/find/FindIndependentSection.tsx) reads it.

function twoDaysAgo(): Date {
  return new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
}

export async function loadIndependentWork(profile: Awaited<ReturnType<typeof getDashboardData>>, types: WorkType[]) {
  const showIndependent = types.includes('part_time') || types.includes('contract')
  const showAdvisory = types.includes('advisory')
  if (!showIndependent && !showAdvisory) return null

  const marketplaceCategories = getRelevantMarketplaceCategories(profile)
  const boardReady = isBoardReady(profile)

  const [phases, marketplaceListings, expertNetworkListings, allBoardListings, signedUpIds, interimSignups, isMember, oldClickThroughs, platformRows, gmailConnection] =
    await Promise.all([
      getInterimLaunchPlan(profile),
      getActiveListings(marketplaceCategories),
      getActiveListings([InterimListingCategory.EXPERT_NETWORK]),
      getActiveListings([boardReady ? InterimListingCategory.BOARD_ADVISORY : InterimListingCategory.NONPROFIT_BOARD]),
      getSignedUpListingIds(profile.id),
      prisma.interimMarketplaceSignup.findMany({
        where: { candidateId: profile.id },
        select: { listing: { select: { name: true, category: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      isActiveMember(profile.id),
      prisma.partnerClickThrough.findMany({
        where: { candidateId: profile.id, section: 'interim_work', createdAt: { lt: twoDaysAgo() } },
        select: { partnerName: true },
        distinct: ['partnerName'],
      }),
      getPlatformActivity(profile.id, 'WORK'),
      prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null }, select: { id: true } }),
    ])
  const everyListing = [...marketplaceListings, ...expertNetworkListings, ...allBoardListings]
  const platformStatuses = statusByListing(everyListing, platformRows)
  const interimSignupMix = computeMarketplaceSignupMix(interimSignups.map((s) => s.listing.category))

  const clickedPartnerNames = new Set(oldClickThroughs.map((c) => c.partnerName))
  const clickedNotRegistered = everyListing.filter((l) => clickedPartnerNames.has(l.name) && !signedUpIds.has(l.id))
  const boardListings = allBoardListings.filter((l) => l.audienceFocus === 'GENERAL' || profile.boardDiversityListingsOptIn === true)
  const hasWomenFocusedListings = allBoardListings.some((l) => l.audienceFocus === 'WOMEN_FOCUSED')

  return {
    showIndependent,
    showAdvisory,
    boardReady,
    phases,
    marketplaceListings,
    expertNetworkListings,
    allBoardListings,
    boardListings,
    signedUpIds,
    interimSignups,
    interimSignupMix,
    isMember,
    platformRows,
    platformStatuses,
    gmailConnected: !!gmailConnection,
    clickedNotRegistered,
    hasWomenFocusedListings,
  }
}

export type IndependentWorkData = NonNullable<Awaited<ReturnType<typeof loadIndependentWork>>>
