import 'server-only'
import { prisma } from '@/lib/prisma'
import { roleForAddress } from '@/lib/seo/role-pages'

// Role networks: one community per named leadership role ("CRO network"), joined by a click on the role's
// public page (/roles/<role>). Owner decisions (2026-11-03): click to join, no size floor, feed and weekly
// digest email both.
//
// Rules, enforced here rather than left to the page:
//   OPT-IN   nothing is ever joined automatically
//   PRIVATE  a member in Confidential Search Mode cannot join (same rule as alumni networks: joining a
//            network makes you visible to it), and is never counted in anyone's feed
//   TRUSTED  the page's state is never trusted; the role is re-resolved from the slug here

export interface RoleNetworkInfo {
  slug: string
  /** "CRO" */
  short: string
  /** "Chief Revenue Officer" */
  spelled: string
  /** "CRO network" */
  label: string
}

export function roleNetworkInfo(address: string): RoleNetworkInfo | null {
  const role = roleForAddress(address)
  if (!role) return null
  return { slug: role.slug, short: role.short, spelled: role.spelled, label: `${role.short} network` }
}

export type RoleNetworkStatus = 'joined' | 'can_join' | 'confidential' | 'signed_out'

export async function roleNetworkStatus(candidateId: string | null, address: string): Promise<RoleNetworkStatus> {
  if (!candidateId) return 'signed_out'
  const info = roleNetworkInfo(address)
  if (!info) return 'can_join'
  const [profile, membership] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { confidentialSearchMode: true } }),
    prisma.communityMembership.findFirst({
      where: { candidateId, leftAt: null, community: { type: 'ROLE', value: info.slug } },
      select: { id: true },
    }),
  ])
  if (membership) return 'joined'
  if (profile?.confidentialSearchMode) return 'confidential'
  return 'can_join'
}

export async function joinRoleNetwork(
  candidateId: string,
  address: string
): Promise<{ ok: true; info: RoleNetworkInfo } | { ok: false; error: string }> {
  const info = roleNetworkInfo(address)
  if (!info) return { ok: false, error: "We couldn't find that role. Try again from the role's page." }
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { confidentialSearchMode: true },
  })
  if (!profile) return { ok: false, error: 'Sign in to join this network.' }
  if (profile.confidentialSearchMode) {
    return { ok: false, error: 'Networks are off while Confidential Search Mode is on, because joining makes you visible to its members.' }
  }
  const community = await prisma.community.upsert({
    where: { type_value: { type: 'ROLE', value: info.slug } },
    create: { type: 'ROLE', value: info.slug, label: info.label },
    update: {},
  })
  await prisma.communityMembership.upsert({
    where: { communityId_candidateId: { communityId: community.id, candidateId } },
    create: { communityId: community.id, candidateId, joinedVia: 'MANUAL', notifiedAt: new Date() },
    // Rejoining after leaving clears the leave.
    update: { leftAt: null, joinedVia: 'MANUAL', notifiedAt: new Date() },
  })
  return { ok: true, info }
}
