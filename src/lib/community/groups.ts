import 'server-only'
import { prisma } from '@/lib/prisma'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

// Automatic "peers like you" groups on the Community page — no join/leave
// action, derived entirely from resume-derived/candidate-set profile data.
// Bounded to ~8 memberships per candidate (seniority band, school, up to 3
// companies, industry, metro, function), so this never grows into a picker
// among alternatives (see design-principles.md's 5+ options rule) — it's a
// fixed-size fact about one candidate, not a choice.
export type CommunityGroupDimension = 'seniority' | 'school' | 'company' | 'industry' | 'metro' | 'function'

// §14: "Segment by seniority band, function second." SENIORITY_BAND_LABEL
// mirrors ResumeAnalysis.seniorityBand's raw-string values (no Prisma enum
// there — see that model's own comment).
export const SENIORITY_BAND_LABEL: Record<string, string> = {
  EARLY: 'Early Career',
  MID: 'Mid-Career',
  SENIOR: 'Senior',
  EXECUTIVE: 'Executive',
}

export interface CommunityGroup {
  dimension: CommunityGroupDimension
  value: string // used in the ?group= query param — normalized for school/company
  label: string // human-readable chip text
  memberCount: number // other candidates sharing this dimension
}

const VISIBLE_TIERS = ['PUBLIC', 'SEMI_PUBLIC'] as const

export async function getCandidateGroups(candidateId: string): Promise<CommunityGroup[]> {
  const [profile, primarySchool, recentCompanies, latestResumeAnalysis] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { industryBucket: true, metroArea: true, primaryFunction: true },
    }),
    prisma.educationEntry.findFirst({
      where: { candidateId, isPrimary: true },
      select: { schoolName: true, schoolNameNormalized: true },
    }),
    prisma.workHistoryEntry.findMany({
      where: { candidateId },
      orderBy: { startDate: 'desc' },
      select: { companyName: true, companyNameNormalized: true },
    }),
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { seniorityBand: true },
    }),
  ])

  // Every group's member count is an independent read — issue them all at
  // once and assemble in the original chip order afterwards (seniority,
  // school, up to 3 companies, industry, metro, function).
  const pending: Promise<CommunityGroup | null>[] = []
  const addCount = (count: Promise<number>, group: Omit<CommunityGroup, 'memberCount'>) => {
    pending.push(count.then((memberCount) => (memberCount >= 1 ? { ...group, memberCount } : null)))
  }

  // §14's primary segmentation axis, so it's the first chip a candidate sees
  // (function, below, is the secondary axis).
  if (latestResumeAnalysis?.seniorityBand) {
    addCount(
      prisma.communityPost.count({
        where: {
          candidateId: { not: candidateId },
          moderationStatus: 'PUBLISHED',
          postSeniorityBand: latestResumeAnalysis.seniorityBand,
        },
      }),
      {
        dimension: 'seniority',
        value: latestResumeAnalysis.seniorityBand,
        label: SENIORITY_BAND_LABEL[latestResumeAnalysis.seniorityBand] ?? latestResumeAnalysis.seniorityBand,
      }
    )
  }

  if (primarySchool && primarySchool.schoolNameNormalized) {
    addCount(
      prisma.candidateProfile.count({
        where: {
          id: { not: candidateId },
          privacyTier: { in: [...VISIBLE_TIERS] },
          educationHistory: { some: { schoolNameNormalized: primarySchool.schoolNameNormalized, isPrimary: true } },
        },
      }),
      { dimension: 'school', value: primarySchool.schoolNameNormalized, label: primarySchool.schoolName }
    )
  }

  const seenCompanies = new Set<string>()
  for (const entry of recentCompanies) {
    if (!entry.companyNameNormalized || seenCompanies.has(entry.companyNameNormalized)) continue
    seenCompanies.add(entry.companyNameNormalized)
    if (seenCompanies.size > 3) break

    addCount(
      prisma.candidateProfile.count({
        where: {
          id: { not: candidateId },
          privacyTier: { in: [...VISIBLE_TIERS] },
          workHistory: { some: { companyNameNormalized: entry.companyNameNormalized } },
        },
      }),
      { dimension: 'company', value: entry.companyNameNormalized, label: entry.companyName }
    )
  }

  if (profile.industryBucket) {
    addCount(
      prisma.candidateProfile.count({
        where: { id: { not: candidateId }, privacyTier: { in: [...VISIBLE_TIERS] }, industryBucket: profile.industryBucket },
      }),
      { dimension: 'industry', value: profile.industryBucket, label: profile.industryBucket }
    )
  }

  // "Other/Remote" isn't a real peer group — excluded per the metro-areas
  // convention (normalizeMetroArea never treats it as a match target).
  if (profile.metroArea && profile.metroArea !== 'Other/Remote') {
    addCount(
      prisma.candidateProfile.count({
        where: { id: { not: candidateId }, privacyTier: { in: [...VISIBLE_TIERS] }, metroArea: profile.metroArea },
      }),
      { dimension: 'metro', value: profile.metroArea, label: profile.metroArea }
    )
  }

  if (profile.primaryFunction && (PRIMARY_FUNCTION_OPTIONS as readonly string[]).includes(profile.primaryFunction)) {
    addCount(
      prisma.candidateProfile.count({
        where: { id: { not: candidateId }, privacyTier: { in: [...VISIBLE_TIERS] }, primaryFunction: profile.primaryFunction },
      }),
      { dimension: 'function', value: profile.primaryFunction, label: profile.primaryFunction }
    )
  }

  const groups = (await Promise.all(pending)).filter((g): g is CommunityGroup => g !== null)

  return groups
}
