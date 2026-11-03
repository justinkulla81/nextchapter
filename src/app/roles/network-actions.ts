'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { PENDING_ROLE_COOKIE, PENDING_ROLE_MAX_AGE_SECONDS } from '@/lib/community/role-network-cookie'
import { joinRoleNetwork, roleNetworkInfo, roleNetworkStatus, type RoleNetworkStatus } from '@/lib/community/role-networks'

async function signedInCandidateId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const profile = await prisma.candidateProfile.findFirst({ where: { userId: user.id }, select: { id: true } })
  return profile?.id ?? null
}

/** Whether the viewer is in this role's network. The role pages are cached for everyone, so this is read after load. */
export async function roleNetworkStatusAction(slug: string): Promise<RoleNetworkStatus> {
  return roleNetworkStatus(await signedInCandidateId(), slug)
}

export type JoinRoleNetworkResult =
  | { status: 'joined' }
  | { status: 'signed_out' }
  | { status: 'error'; error: string }

/** The join click. Signed in: joins now. Signed out: remembers the role for two weeks so signup finishes the join. */
export async function joinRoleNetworkAction(slug: string): Promise<JoinRoleNetworkResult> {
  const info = roleNetworkInfo(slug)
  if (!info) return { status: 'error', error: "We couldn't find that role. Reload the page and try again." }
  const candidateId = await signedInCandidateId()
  if (!candidateId) {
    const jar = await cookies()
    jar.set(PENDING_ROLE_COOKIE, info.slug, { maxAge: PENDING_ROLE_MAX_AGE_SECONDS, path: '/', sameSite: 'lax', secure: true })
    return { status: 'signed_out' }
  }
  const result = await joinRoleNetwork(candidateId, info.slug)
  captureServerEvent(candidateId, 'role_network_joined', { roleSlug: info.slug, source: 'role_page', ok: result.ok, completedAfterSignup: false })
  if (!result.ok) return { status: 'error', error: result.error }
  revalidatePath('/dashboard/community')
  return { status: 'joined' }
}

/** Dashboard load after signup: turns the cookie left by a signed-out click into the membership, once. */
export async function applyPendingRoleJoinAction(): Promise<{ joinedLabel: string | null }> {
  const jar = await cookies()
  const slug = jar.get(PENDING_ROLE_COOKIE)?.value
  if (!slug) return { joinedLabel: null }
  const candidateId = await signedInCandidateId()
  if (!candidateId) return { joinedLabel: null }
  jar.delete(PENDING_ROLE_COOKIE)
  const result = await joinRoleNetwork(candidateId, slug)
  captureServerEvent(candidateId, 'role_network_joined', { roleSlug: slug, source: 'role_page', ok: result.ok, completedAfterSignup: true })
  if (!result.ok) return { joinedLabel: null }
  revalidatePath('/dashboard/community')
  return { joinedLabel: result.info.label }
}
