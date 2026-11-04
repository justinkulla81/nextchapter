import 'server-only'
import type { CommunityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { roleForAddress } from '@/lib/seo/role-pages'
import { functionByName, functionBySlug, industryByName, industryBySlug } from '@/lib/seo/topics'
import type { NetworkKind } from '@/lib/community/network-copy'

// Peer networks: a community a visitor joins by clicking "Join the CRO network" (or "...Sales network", "...Health care
// network") on the matching public page: a role page, a function page or an industry page. Owner decisions (2026-11-03):
// click to join, no size floor, feed and weekly digest email both.
//
// Rules, enforced here rather than left to the page:
//   OPT-IN   a click is the only way in. Function and industry communities also exist as profile-based auto-joins; those
//            members are not "in the network" for the digest until they click (joinedVia MANUAL)
//   PRIVATE  a member in Confidential Search Mode cannot join (joining makes you visible to the network's members)
//   TRUSTED  the page's state is never trusted; the network is re-resolved from its key here

export interface NetworkInfo {
  kind: NetworkKind
  type: Extract<CommunityType, 'ROLE' | 'FUNCTION' | 'INDUSTRY'>
  /** `<kind>:<slug>`: what the page, the actions and the signup cookie pass around. */
  key: string
  /** The Community.value: the role's canonical slug, or the function / industry name (the same text profile auto-joins use). */
  value: string
  /** Short form: "CRO", "Sales", "Health care". */
  name: string
  /** Role spelled out ("Chief Revenue Officer"); the name itself for functions and industries. */
  spelled: string
  /** Community.label when the community is first created. */
  label: string
  /** "CRO network" */
  networkName: string
}

/** Accepts `role:cro`, `function:sales`, `industry:health-care`; a bare slug is a role (cookies set before function and industry networks). */
export function networkInfo(key: string): NetworkInfo | null {
  const i = key.indexOf(':')
  const kind = i === -1 ? 'role' : key.slice(0, i)
  const slug = i === -1 ? key : key.slice(i + 1)
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null
  if (kind === 'role') {
    const role = roleForAddress(slug)
    if (!role) return null
    return { kind: 'role', type: 'ROLE', key: `role:${role.slug}`, value: role.slug, name: role.short, spelled: role.spelled, label: `${role.short} network`, networkName: `${role.short} network` }
  }
  if (kind === 'function') {
    const fn = functionBySlug(slug)
    if (!fn) return null
    return { kind: 'function', type: 'FUNCTION', key: `function:${fn.slug}`, value: fn.name, name: fn.name, spelled: fn.name, label: fn.name, networkName: `${fn.name} network` }
  }
  if (kind === 'industry') {
    const ind = industryBySlug(slug)
    if (!ind) return null
    return { kind: 'industry', type: 'INDUSTRY', key: `industry:${ind.slug}`, value: ind.name, name: ind.name, spelled: ind.name, label: ind.name, networkName: `${ind.name} network` }
  }
  return null
}

export type NetworkStatus = 'joined' | 'can_join' | 'confidential' | 'signed_out'

export async function networkStatus(candidateId: string | null, key: string): Promise<NetworkStatus> {
  if (!candidateId) return 'signed_out'
  const info = networkInfo(key)
  if (!info) return 'can_join'
  const [profile, membership] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { confidentialSearchMode: true } }),
    // MANUAL only: a profile auto-join into the same function or industry community is not a click on this page.
    prisma.communityMembership.findFirst({
      where: { candidateId, leftAt: null, joinedVia: 'MANUAL', community: { type: info.type, value: info.value } },
      select: { id: true },
    }),
  ])
  if (membership) return 'joined'
  if (profile?.confidentialSearchMode) return 'confidential'
  return 'can_join'
}

export async function joinNetwork(
  candidateId: string,
  key: string
): Promise<{ ok: true; info: NetworkInfo } | { ok: false; error: string }> {
  const info = networkInfo(key)
  if (!info) return { ok: false, error: "We couldn't find that network. Try again from the page you came from." }
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { confidentialSearchMode: true },
  })
  if (!profile) return { ok: false, error: 'Sign in to join this network.' }
  if (profile.confidentialSearchMode) {
    return { ok: false, error: 'Networks are off while Confidential Search Mode is on, because joining makes you visible to its members.' }
  }
  const community = await prisma.community.upsert({
    where: { type_value: { type: info.type, value: info.value } },
    create: { type: info.type, value: info.value, label: info.label },
    update: {},
  })
  await prisma.communityMembership.upsert({
    where: { communityId_candidateId: { communityId: community.id, candidateId } },
    create: { communityId: community.id, candidateId, joinedVia: 'MANUAL', notifiedAt: new Date() },
    // Rejoining after leaving clears the leave; an auto-joined member who clicks becomes a deliberate member.
    update: { leftAt: null, joinedVia: 'MANUAL', notifiedAt: new Date() },
  })
  return { ok: true, info }
}

/** The network a stored community stands for, for the digest. Null when the community is not one a page offers. */
export function networkInfoForCommunity(type: CommunityType, value: string): NetworkInfo | null {
  if (type === 'ROLE') return networkInfo(`role:${value}`)
  if (type === 'FUNCTION') {
    const fn = functionByName(value)
    return fn ? networkInfo(`function:${fn.slug}`) : null
  }
  if (type === 'INDUSTRY') {
    const ind = industryByName(value)
    return ind ? networkInfo(`industry:${ind.slug}`) : null
  }
  return null
}
