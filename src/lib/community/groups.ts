import 'server-only'
import { prisma } from '@/lib/prisma'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

// Automatic "peers like you" groups on the Community page — no join/leave
// action, derived entirely from resume-derived/candidate-set profile data.
// Bounded to ~7 memberships per candidate (school, up to 3 companies,
// industry, metro, function), so this never grows into a picker among
// alternatives (see design-principles.md's 5+ options rule) — it's a
// fixed-size fact about one candidate, not a choice.
export type CommunityGroupDimension = 'school' | 'company' | 'industry' | 'metro' | 'function'

export interface CommunityGroup {
  dimension: CommunityGroupDimension
  value: string // used in the ?group= query param — normalized for school/company
  label: string // human-readable chip text
  memberCount: number // other candidates sharing this dimension
}

const VISIBLE_TIERS = ['PUBLIC', 'SEMI_PUBLIC'] as const

export async function getCandidateGroups(candidateId: string): Promise<CommunityGroup[]> {
  const [profile, primarySchool, recentCompanies] = await Promise.all([
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
  ])

  const groups: CommunityGroup[] = []

  if (primarySchool && primarySchool.schoolNameNormalized) {
    const count = await prisma.candidateProfile.count({
      where: {
        id: { not: candidateId },
        privacyTier: { in: [...VISIBLE_TIERS] },
        educationHistory: { some: { schoolNameNormalized: primarySchool.schoolNameNormalized, isPrimary: true } },
      },
    })
    if (count >= 1) {
      groups.push({ dimension: 'school', value: primarySchool.schoolNameNormalized, label: primarySchool.schoolName, memberCount: count })
    }
  }

  const seenCompanies = new Set<string>()
  for (const entry of recentCompanies) {
    if (!entry.companyNameNormalized || seenCompanies.has(entry.companyNameNormalized)) continue
    seenCompanies.add(entry.companyNameNormalized)
    if (seenCompanies.size > 3) break

    const count = await prisma.candidateProfile.count({
      where: {
        id: { not: candidateId },
        privacyTier: { in: [...VISIBLE_TIERS] },
        workHistory: { some: { companyNameNormalized: entry.companyNameNormalized } },
      },
    })
    if (count >= 1) {
      groups.push({ dimension: 'company', value: entry.companyNameNormalized, label: entry.companyName, memberCount: count })
    }
  }

  if (profile.industryBucket) {
    const count = await prisma.candidateProfile.count({
      where: { id: { not: candidateId }, privacyTier: { in: [...VISIBLE_TIERS] }, industryBucket: profile.industryBucket },
    })
    if (count >= 1) groups.push({ dimension: 'industry', value: profile.industryBucket, label: profile.industryBucket, memberCount: count })
  }

  // "Other/Remote" isn't a real peer group — excluded per the metro-areas
  // convention (normalizeMetroArea never treats it as a match target).
  if (profile.metroArea && profile.metroArea !== 'Other/Remote') {
    const count = await prisma.candidateProfile.count({
      where: { id: { not: candidateId }, privacyTier: { in: [...VISIBLE_TIERS] }, metroArea: profile.metroArea },
    })
    if (count >= 1) groups.push({ dimension: 'metro', value: profile.metroArea, label: profile.metroArea, memberCount: count })
  }

  if (profile.primaryFunction && (PRIMARY_FUNCTION_OPTIONS as readonly string[]).includes(profile.primaryFunction)) {
    const count = await prisma.candidateProfile.count({
      where: { id: { not: candidateId }, privacyTier: { in: [...VISIBLE_TIERS] }, primaryFunction: profile.primaryFunction },
    })
    if (count >= 1) groups.push({ dimension: 'function', value: profile.primaryFunction, label: profile.primaryFunction, memberCount: count })
  }

  return groups
}
