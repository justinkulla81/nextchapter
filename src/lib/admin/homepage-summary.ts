import 'server-only'
import { prisma } from '@/lib/prisma'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface AdminApprovalsNeeded {
  pendingJobBoardListings: number
  pendingBountyClaims: number
  unresolvedReferenceDisputes: number
  pendingIntroRequests: number
}

export interface AdminRecentActivity {
  newCandidateSignups: number
  newJobBoardListings: number
  newRecruiterOptIns: number
}

export interface AdminHighLevelStats {
  totalCandidates: number
  registeredCandidates: number
  totalCoaches: number
  totalRecruiters: number
  totalHiringManagers: number
  liveJobBoardListings: number
  thisWeekAListCount: number
}

export interface AdminHomepageSummary {
  approvalsNeeded: AdminApprovalsNeeded
  recentActivity: AdminRecentActivity
  stats: AdminHighLevelStats
}

// This week's A-List count — sourced from WeeklyBadgeEarned, the real,
// currently-written record (SundayNightReport.onAList is legacy and nothing
// writes to it anymore, see weekly-badge-archive.ts). "This week" is the
// most recent weekStartDate on record, same convention used there.
async function thisWeekAListCount(): Promise<number> {
  const latest = await prisma.weeklyBadgeEarned.findFirst({
    where: { badgeKey: 'WEEKLY_SCORE_A_LIST' },
    orderBy: { weekStartDate: 'desc' },
    select: { weekStartDate: true },
  })
  if (!latest) return 0
  return prisma.weeklyBadgeEarned.count({
    where: { weekStartDate: latest.weekStartDate, badgeKey: 'WEEKLY_SCORE_A_LIST' },
  })
}

export async function getAdminHomepageSummary(): Promise<AdminHomepageSummary> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

  const [
    pendingJobBoardListings,
    pendingBountyClaims,
    unresolvedReferenceDisputes,
    pendingIntroRequests,
    newCandidateSignups,
    newJobBoardListings,
    newRecruiterOptIns,
    totalCandidates,
    registeredCandidates,
    totalCoaches,
    totalRecruiters,
    totalHiringManagers,
    liveJobBoardListings,
    aListCount,
  ] = await Promise.all([
    prisma.exclusiveJobPosting.count({ where: { status: 'pending', archivedAt: null } }),
    prisma.bountyClaim.count({ where: { status: 'PENDING' } }),
    prisma.reference.count({ where: { candidateDisputedAt: { not: null }, disputeResolvedAt: null } }),
    prisma.jobBoardIntroRequest.count({ where: { status: 'pending' } }),
    prisma.candidateProfile.count({ where: { registrationCompletedAt: { gte: sevenDaysAgo } } }),
    prisma.exclusiveJobPosting.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.candidateProfile.count({ where: { recruiterDatabaseRequestedAt: { gte: sevenDaysAgo } } }),
    prisma.candidateProfile.count(),
    prisma.candidateProfile.count({ where: { registrationCompletedAt: { not: null } } }),
    prisma.coach.count(),
    prisma.recruiter.count(),
    prisma.employerProfile.count(),
    prisma.exclusiveJobPosting.count({ where: { status: 'approved', archivedAt: null } }),
    thisWeekAListCount(),
  ])

  return {
    approvalsNeeded: {
      pendingJobBoardListings,
      pendingBountyClaims,
      unresolvedReferenceDisputes,
      pendingIntroRequests,
    },
    recentActivity: {
      newCandidateSignups,
      newJobBoardListings,
      newRecruiterOptIns,
    },
    stats: {
      totalCandidates,
      registeredCandidates,
      totalCoaches,
      totalRecruiters,
      totalHiringManagers,
      liveJobBoardListings,
      thisWeekAListCount: aListCount,
    },
  }
}
