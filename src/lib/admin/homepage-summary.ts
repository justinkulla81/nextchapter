import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface AdminApprovalsNeeded {
  pendingJobBoardListings: number
  pendingBountyClaims: number
  unresolvedReferenceDisputes: number
  pendingIntroRequests: number
  pendingImportedReviews: number
  pendingScholarshipApplications: number
  pendingIdentityMatches: number
  pendingEqOverIqApplications: number
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
  totalEmployers: number
  liveJobBoardListings: number
  thisWeekSprintTargetCount: number
}

export interface AdminHomepageSummary {
  approvalsNeeded: AdminApprovalsNeeded
  recentActivity: AdminRecentActivity
  stats: AdminHighLevelStats
}

// This week's Sprint Target count — sourced from WeeklyBadgeEarned, the
// real, currently-written record (SundayNightReport.onAList is legacy and
// nothing writes to it anymore, see weekly-badge-archive.ts). "This week" is
// the most recent weekStartDate on record, same convention used there.
async function thisWeekSprintTargetCount(): Promise<number> {
  const latest = await prisma.weeklyBadgeEarned.findFirst({
    where: { badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
    orderBy: { weekStartDate: 'desc' },
    select: { weekStartDate: true },
  })
  if (!latest) return 0
  return prisma.weeklyBadgeEarned.count({
    where: { weekStartDate: latest.weekStartDate, badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
  })
}

// The two big counts over the ~320k-row ExclusiveJobPosting table (one a sequential scan) took
// 15-60s each in production. They are admin-only global numbers, so they are cached across
// serverless instances with unstable_cache (5 minutes, tag 'admin-job-counts') instead of
// only per instance. Meaning of each count is unchanged. The pending-listings count is NOT in
// here: it is the badge admins act on, it reads few rows through an index, and it must update
// as soon as a listing is approved or rejected.
export const ADMIN_JOB_COUNTS_TAG = 'admin-job-counts'

const loadJobPostingCounts = unstable_cache(
  async () => {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)
    const [newJobBoardListings, liveJobBoardListings] = await Promise.all([
      prisma.exclusiveJobPosting.count({ where: { createdAt: { gte: sevenDaysAgo }, status: { not: 'rejected' } } }),
      prisma.exclusiveJobPosting.count({ where: { status: 'approved', archivedAt: null } }),
    ])
    return { newJobBoardListings, liveJobBoardListings }
  },
  ['admin-job-posting-counts-v1'],
  { revalidate: 300, tags: [ADMIN_JOB_COUNTS_TAG] },
)

// Runs ~17 counts, two of them scans of the job table, and the admin layout calls it on every
// navigation (and again from the admin home page). cache() dedupes it within a request; the
// 60s memo means a click-through across admin pages pays for it once. Badge counts can be up
// to a minute stale, which is fine for an approvals-needed badge.
const SUMMARY_TTL_MS = 60_000
let summaryCache: { at: number; value: Promise<AdminHomepageSummary> } | null = null

export const getAdminHomepageSummary = cache(function getAdminHomepageSummary(): Promise<AdminHomepageSummary> {
  if (!summaryCache || Date.now() - summaryCache.at > SUMMARY_TTL_MS) {
    const value = loadAdminHomepageSummary()
    summaryCache = { at: Date.now(), value }
    value.catch(() => {
      if (summaryCache?.value === value) summaryCache = null
    })
  }
  return summaryCache.value
})

async function loadAdminHomepageSummary(): Promise<AdminHomepageSummary> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

  const [
    jobCounts,
    pendingJobBoardListings,
    pendingBountyClaims,
    unresolvedReferenceDisputes,
    pendingIntroRequests,
    pendingImportedReviews,
    pendingScholarshipApplications,
    pendingIdentityMatches,
    pendingEqOverIqApplications,
    newCandidateSignups,
    newRecruiterOptIns,
    totalCandidates,
    registeredCandidates,
    totalCoaches,
    totalRecruiters,
    totalEmployers,
    sprintTargetCount,
  ] = await Promise.all([
    loadJobPostingCounts(),
    prisma.exclusiveJobPosting.count({ where: { status: 'pending', archivedAt: null } }),
    prisma.bountyClaim.count({ where: { status: 'PENDING' } }),
    prisma.reference.count({ where: { candidateDisputedAt: { not: null }, disputeResolvedAt: null } }),
    prisma.jobBoardIntroRequest.count({ where: { status: 'pending' } }),
    prisma.externalReviewStat.count({ where: { status: 'NEEDS_REVIEW' } }).catch(() => 0),
    prisma.scholarshipApplication.count({ where: { status: 'PENDING' } }),
    prisma.candidateIdentityMatch.count({ where: { status: 'PENDING' } }),
    prisma.eqOverIqContributorProfile.count({ where: { submittedAt: { not: null }, status: 'PENDING' } }),
    prisma.candidateProfile.count({ where: { registrationCompletedAt: { gte: sevenDaysAgo } } }),
    prisma.candidateProfile.count({ where: { recruiterDatabaseRequestedAt: { gte: sevenDaysAgo } } }),
    prisma.candidateProfile.count({ where: EXCLUDE_SYSTEM_ACCOUNT }),
    prisma.candidateProfile.count({ where: { registrationCompletedAt: { not: null } } }),
    prisma.coach.count(),
    prisma.recruiter.count(),
    prisma.employerProfile.count(), // Talent portal employers
    thisWeekSprintTargetCount(),
  ])

  const { newJobBoardListings, liveJobBoardListings } = jobCounts
  return {
    approvalsNeeded: {
      pendingJobBoardListings,
      pendingBountyClaims,
      unresolvedReferenceDisputes,
      pendingIntroRequests,
      pendingImportedReviews,
      pendingScholarshipApplications,
      pendingIdentityMatches,
      pendingEqOverIqApplications,
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
      totalEmployers,
      liveJobBoardListings,
      thisWeekSprintTargetCount: sprintTargetCount,
    },
  }
}
