'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { roleBySlug } from '@/lib/seo/role-pages'
import { ROLE_FEED_PATH } from '@/lib/roles/role-feed-rules'
import { captureServerEvent } from '@/lib/posthog/server'

/**
 * Sets what the member has chosen on their role network, creating the membership as it is chosen when none exists yet: the feed
 * shows from the member's title before the weekly pass has joined them, and a choice made then must hold when it does.
 */
async function setRoleMembership(candidateId: string, roleSlug: string, data: { leftAt?: Date | null; turnoverMutedAt?: Date | null }) {
  const role = roleBySlug(roleSlug)
  if (!role) return null
  const community = await prisma.community.upsert({
    where: { type_value: { type: 'ROLE', value: role.slug } },
    create: { type: 'ROLE', value: role.slug, label: `${role.short} network` },
    update: {},
  })
  await prisma.communityMembership.upsert({
    where: { communityId_candidateId: { communityId: community.id, candidateId } },
    create: { communityId: community.id, candidateId, joinedVia: 'AUTO', notifiedAt: new Date(), ...data },
    update: data,
  })
  return community.id
}

/** Turns the role feed off: the member leaves the role network, so the weekly digest stops and the feed is not offered again. */
export async function leaveRoleFeedAction(roleSlug: string): Promise<void> {
  const profile = await getDashboardProfile()
  const communityId = await setRoleMembership(profile.id, roleSlug, { leftAt: new Date() })
  if (communityId) captureServerEvent(profile.id, 'role_feed_left', { roleSlug, communityId })
  revalidatePath('/dashboard/network')
  redirect('/dashboard/network')
}

/** Turns the officer-change news off or on, in the feed and in the weekly email. */
export async function setTurnoverMutedAction(roleSlug: string, muted: boolean): Promise<void> {
  const profile = await getDashboardProfile()
  const communityId = await setRoleMembership(profile.id, roleSlug, { turnoverMutedAt: muted ? new Date() : null })
  if (communityId) captureServerEvent(profile.id, 'role_feed_turnover_muted', { roleSlug, muted })
  revalidatePath(ROLE_FEED_PATH)
  redirect(`${ROLE_FEED_PATH}?role=${encodeURIComponent(roleSlug)}`)
}
