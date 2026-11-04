import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommunityType } from '@prisma/client'
import { rolesForMember } from '@/lib/roles/resources-rules'

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
  // Two independent reads, issued together. Every later write is gated on
  // what these return, so a member who already has a row for every dimension
  // they match costs just these two reads and no writes.
  const [profile, memberships] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        currentCity: true,
        primaryFunction: true,
        industryContext: true,
        layoffCohortId: true,
        layoffCohort: { select: { companyName: true } },
        resumeLatestJobTitle: true,
        targetRoleType: true,
        confidentialSearchMode: true,
      },
    }),
    prisma.communityMembership.findMany({
      where: { candidateId },
      select: { joinedVia: true, community: { select: { type: true } } },
    }),
  ])
  if (!profile) return

  // Only auto-join rows count: a function or industry network the member joined by clicking on a page must not stop their
  // own function and industry from being joined (and leaving an auto-joined community stays permanent, as that row remains).
  const existingTypes = new Set(memberships.filter((m) => m.joinedVia === 'AUTO').map((m) => m.community.type))

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

  // The leadership roles the member holds or is aiming for (a CRO, a VP of Sales) each get their role network, which carries the
  // weekly role digest: recruiters, conferences, training, officer changes and media. Owner decision 2026-11-04: automatic, with
  // an unsubscribe link in every digest. Not for a member in Confidential Search Mode, and never again after they leave: a
  // left row stays, so the upsert below changes nothing for it.
  if (!profile.confidentialSearchMode) {
    for (const role of rolesForMember([profile.resumeLatestJobTitle, profile.targetRoleType])) {
      dimensions.push({ type: 'ROLE', value: role.slug, label: `${role.short} network` })
    }
  }

  // One dimension type each, so the joins don't depend on one another.
  await Promise.all(
    dimensions.map(async (dim) => {
      const community = await prisma.community.upsert({
        where: { type_value: { type: dim.type, value: dim.value } },
        create: { type: dim.type, value: dim.value, label: dim.label, layoffCohortId: dim.layoffCohortId },
        update: {},
      })
      // An upsert that changes nothing when the row exists: the member may already hold this very community from a click on a
      // page (or have left it), and that row, not a second one, is what stands.
      await prisma.communityMembership.upsert({
        where: { communityId_candidateId: { communityId: community.id, candidateId } },
        create: { communityId: community.id, candidateId, joinedVia: 'AUTO' },
        update: {},
      })
    })
  )
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
export function communityPostWhere(community: { type: CommunityType; value: string; communityId?: string } | null) {
  if (!community) return {}
  if (community.type === 'CITY') return { postCity: community.value }
  // Function and industry communities are filled two ways: profile auto-joins (posts tagged with the same text) and members
  // who clicked "Join the ... network" on the page (posts of the network's members). The feed is both. `AND` rather than `OR`
  // so it cannot be overwritten by the moderation filter the page spreads after it.
  if (community.type === 'FUNCTION' || community.type === 'INDUSTRY') {
    const tagged = community.type === 'FUNCTION' ? { postFunction: community.value } : { postIndustry: community.value }
    if (!community.communityId) return tagged
    return {
      AND: [
        {
          OR: [
            tagged,
            { candidate: { communityMemberships: { some: { communityId: community.communityId, leftAt: null } }, confidentialSearchMode: false } },
          ],
        },
      ],
    }
  }
  // Alumni and role networks have no tag on a post; they are the posts of the network's
  // members. Fails CLOSED: without the community's id the filter matches nothing,
  // never "everyone".
  if (community.type === 'SCHOOL' || community.type === 'FORMER_EMPLOYER' || community.type === 'ROLE') {
    if (!community.communityId) return { id: '__no_such_post__' }
    return {
      candidate: {
        communityMemberships: { some: { communityId: community.communityId, leftAt: null } },
        confidentialSearchMode: false,
      },
    }
  }
  return {}
}

/**
 * Weekly catch-up for the role networks: every member whose latest title or target role is a leadership role with a page gets
 * that role's network, joined as AUTO. Profile saves happen in many places, so one pass here is how a member who set a title
 * anywhere is found. Skips Confidential Search Mode and deactivated or sample accounts, and never touches a row that exists (a
 * member who left stays left). Returns how many memberships it created.
 */
export async function autoJoinRoleNetworks(deadlineAt: number): Promise<number> {
  let created = 0
  let cursor: string | undefined
  const communityIds = new Map<string, string>()
  for (;;) {
    if (Date.now() > deadlineAt) break
    const batch = await prisma.candidateProfile.findMany({
      where: {
        confidentialSearchMode: false,
        deactivatedAt: null,
        isSampleData: false,
        isSystemAccount: false,
        OR: [{ resumeLatestJobTitle: { not: null } }, { targetRoleType: { not: null } }],
      },
      select: {
        id: true,
        resumeLatestJobTitle: true,
        targetRoleType: true,
        communityMemberships: { where: { community: { type: 'ROLE' } }, select: { community: { select: { value: true } } } },
      },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    for (const c of batch) {
      const have = new Set(c.communityMemberships.map((m) => m.community.value))
      for (const role of rolesForMember([c.resumeLatestJobTitle, c.targetRoleType])) {
        if (have.has(role.slug)) continue
        let communityId = communityIds.get(role.slug)
        if (!communityId) {
          const community = await prisma.community.upsert({
            where: { type_value: { type: 'ROLE', value: role.slug } },
            create: { type: 'ROLE', value: role.slug, label: `${role.short} network` },
            update: {},
          })
          communityId = community.id
          communityIds.set(role.slug, communityId)
        }
        await prisma.communityMembership.upsert({
          where: { communityId_candidateId: { communityId, candidateId: c.id } },
          create: { communityId, candidateId: c.id, joinedVia: 'AUTO' },
          update: {},
        })
        created += 1
      }
    }
    if (batch.length < 1000) break
  }
  return created
}
