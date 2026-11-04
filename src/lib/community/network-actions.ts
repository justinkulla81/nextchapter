'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { LEGACY_PENDING_ROLE_COOKIE, PENDING_NETWORK_COOKIE, PENDING_NETWORK_MAX_AGE_SECONDS } from '@/lib/community/network-cookie'
import { joinNetwork, networkInfo, networkStatus, type NetworkStatus } from '@/lib/community/peer-networks'

async function signedInCandidateId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const profile = await prisma.candidateProfile.findFirst({ where: { userId: user.id }, select: { id: true } })
  return profile?.id ?? null
}

/** Whether the viewer is in this network. The public pages are cached for everyone, so this is read after load. */
export async function networkStatusAction(key: string): Promise<NetworkStatus> {
  return networkStatus(await signedInCandidateId(), key)
}

export type JoinNetworkResult =
  | { status: 'joined' }
  | { status: 'signed_out' }
  | { status: 'error'; error: string }

/** The join click. Signed in: joins now. Signed out: remembers the network for two weeks so signup finishes the join. */
export async function joinNetworkAction(key: string): Promise<JoinNetworkResult> {
  const info = networkInfo(key)
  if (!info) return { status: 'error', error: "We couldn't find that network. Reload the page and try again." }
  const candidateId = await signedInCandidateId()
  if (!candidateId) {
    const jar = await cookies()
    jar.set(PENDING_NETWORK_COOKIE, info.key, { maxAge: PENDING_NETWORK_MAX_AGE_SECONDS, path: '/', sameSite: 'lax', secure: true })
    return { status: 'signed_out' }
  }
  const result = await joinNetwork(candidateId, info.key)
  captureServerEvent(candidateId, 'network_joined', { networkKind: info.kind, networkKey: info.key, source: 'page', ok: result.ok, completedAfterSignup: false })
  if (!result.ok) return { status: 'error', error: result.error }
  revalidatePath('/dashboard/community')
  return { status: 'joined' }
}

/** Dashboard load after signup: turns the cookie left by a signed-out click into the membership, once. */
export async function applyPendingNetworkJoinAction(): Promise<{ joinedLabel: string | null }> {
  const jar = await cookies()
  const key = jar.get(PENDING_NETWORK_COOKIE)?.value ?? jar.get(LEGACY_PENDING_ROLE_COOKIE)?.value
  if (!key) return { joinedLabel: null }
  const candidateId = await signedInCandidateId()
  if (!candidateId) return { joinedLabel: null }
  jar.delete(PENDING_NETWORK_COOKIE)
  jar.delete(LEGACY_PENDING_ROLE_COOKIE)
  const result = await joinNetwork(candidateId, key)
  captureServerEvent(candidateId, 'network_joined', { networkKind: networkInfo(key)?.kind ?? null, networkKey: key, source: 'page', ok: result.ok, completedAfterSignup: true })
  if (!result.ok) return { joinedLabel: null }
  revalidatePath('/dashboard/community')
  return { joinedLabel: result.info.networkName }
}
