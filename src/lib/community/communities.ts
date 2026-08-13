import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommunityType } from '@prisma/client'

interface AutoJoinDimension {
  type: CommunityType
  value: string
  label: string
  layoffCohortId?: string
}

// One auto-join per dimension type, ever — a candidate who later edits their
// city/function/industry doesn't get silently re-joined to a new community
// for that dimension, and a candidate who manually leaves is never
// re-auto-joined (both cases already have a CommunityMembership row for that
// type, matched or left, so this loop skips them).
export async function syncAutoJoinedCommunities(candidateId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      currentCity: true,
      primaryFunction: true,
      industryContext: true,
      layoffCohortId: true,
      layoffCohort: { select: { companyName: true } },
    },
  })
  if (!profile) return

  const existingTypes = new Set(
    (
      await prisma.communityMembership.findMany({
        where: { candidateId },
        select: { community: { select: { type: true } } },
      })
    ).map((m) => m.community.type)
  )

  const dimensions: AutoJoinDimension[] = []
  if (profile.currentCity && !existingTypes.has('CITY')) {
    dimensions.push({ type: 'CITY', value: profile.currentCity, label: profile.currentCity })
  }
  if (profile.primaryFunction && !existingTypes.has('FUNCTION')) {
    dimensions.push({ type: 'FUNCTION', value: profile.primaryFunction, label: profile.primaryFunction })
  }
  if (profile.industryContext && !existingTypes.has('INDUSTRY')) {
    dimensions.push({ type: 'INDUSTRY', value: profile.industryContext, label: profile.industryContext })
  }
  if (profile.layoffCohortId && profile.layoffCohort && !existingTypes.has('EX_COMPANY')) {
    dimensions.push({
      type: 'EX_COMPANY',
      value: profile.layoffCohort.companyName,
      label: `Ex-${profile.layoffCohort.companyName}`,
      layoffCohortId: profile.layoffCohortId,
    })
  }

  for (const dim of dimensions) {
    const community = await prisma.community.upsert({
      where: { type_value: { type: dim.type, value: dim.value } },
      create: { type: dim.type, value: dim.value, label: dim.label, layoffCohortId: dim.layoffCohortId },
      update: {},
    })
    await prisma.communityMembership.create({
      data: { communityId: community.id, candidateId, joinedVia: 'AUTO' },
    })
  }
}

// Batches every un-acknowledged auto-join into one specific-named banner —
// "You've been added to: San Francisco, Product" — never a per-community
// toast and never generic "you've joined some communities" copy.
export async function getPendingAutoJoinNotices(candidateId: string) {
  const memberships = await prisma.communityMembership.findMany({
    where: { candidateId, notifiedAt: null, leftAt: null },
    include: { community: { select: { label: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  return memberships.map((m) => ({ membershipId: m.id, label: m.community.label }))
}

export async function acknowledgeAutoJoinNotices(candidateId: string) {
  await prisma.communityMembership.updateMany({
    where: { candidateId, notifiedAt: null },
    data: { notifiedAt: new Date() },
  })
}

export async function getCandidateCommunities(candidateId: string) {
  const memberships = await prisma.communityMembership.findMany({
    where: { candidateId, leftAt: null },
    include: { community: true },
    orderBy: { community: { type: 'asc' } },
  })
  return memberships.map((m) => ({
    membershipId: m.id,
    communityId: m.community.id,
    type: m.community.type,
    value: m.community.value,
    label: m.community.label,
  }))
}

// Manual leave only — joining a City/Function/Industry community you don't
// already match on your own profile data is out of scope (no browse-any
// picker; see the Community rework plan).
export async function leaveCommunity(candidateId: string, communityId: string) {
  await prisma.communityMembership.updateMany({
    where: { candidateId, communityId, leftAt: null },
    data: { leftAt: new Date() },
  })
}

// Prisma filter for the candidate's active community selection —
// community/page.tsx keys the existing postCity/postFunction/postIndustry
// where clause off this instead of raw searchParams.city/function/industry.
export function communityPostWhere(community: { type: CommunityType; value: string } | null) {
  if (!community) return {}
  if (community.type === 'CITY') return { postCity: community.value }
  if (community.type === 'FUNCTION') return { postFunction: community.value }
  if (community.type === 'INDUSTRY') return { postIndustry: community.value }
  return {}
}
