'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { leaveCommunity } from '@/lib/community/communities'
import { roleBySlug } from '@/lib/seo/role-pages'
import { captureServerEvent } from '@/lib/posthog/server'

/** Turns the role feed off: the member leaves the role network, so the weekly digest stops. They stay out (a left row is never re-joined). */
export async function leaveRoleFeedAction(roleSlug: string): Promise<void> {
  const profile = await getDashboardProfile()
  if (!roleBySlug(roleSlug)) return
  const community = await prisma.community.findUnique({ where: { type_value: { type: 'ROLE', value: roleSlug } }, select: { id: true } })
  if (community) await leaveCommunity(profile.id, community.id)
  captureServerEvent(profile.id, 'role_feed_left', { roleSlug, communityId: community?.id ?? null })
  revalidatePath('/dashboard/network')
  redirect('/dashboard/network?feed=off')
}
