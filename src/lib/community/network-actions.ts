'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { LEGACY_PENDING_ROLE_COOKIE, PENDING_NETWORK_COOKIE, PENDING_NETWORK_MAX_AGE_SECONDS, networkCookieDomain } from '@/lib/community/network-cookie'
import { joinNetwork, networkInfo } from '@/lib/community/peer-networks'

export type StartNetworkJoinResult = { ok: true } | { ok: false; error: string }

/**
 * The click on a public page. Public pages (a different host from the member app) cannot see a member's session, so this
 * never joins anyone: it remembers which network was asked for, in a cookie both hosts share, and the member app finishes the
 * join as soon as it has a signed-in member (applyPendingNetworkJoinAction).
 */
export async function startNetworkJoinAction(key: string): Promise<StartNetworkJoinResult> {
  const info = networkInfo(key)
  if (!info) return { ok: false, error: "We couldn't find that network. Reload the page and try again." }
  const [jar, h] = await Promise.all([cookies(), headers()])
  jar.set(PENDING_NETWORK_COOKIE, info.key, {
    maxAge: PENDING_NETWORK_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: true,
    domain: networkCookieDomain(h.get('host')),
  })
  return { ok: true }
}

export type ApplyNetworkJoinResult = { joinedLabel: string | null; error: string | null }

/**
 * Runs in the member app (onboarding and dashboard). Turns the cookie left by a click into the membership, once. A visitor who
 * is still anonymous (onboarding gives every visitor a throwaway session) is left alone and the cookie kept, so the join
 * happens when they have a real account.
 */
export async function applyPendingNetworkJoinAction(): Promise<ApplyNetworkJoinResult> {
  const jar = await cookies()
  const key = jar.get(PENDING_NETWORK_COOKIE)?.value ?? jar.get(LEGACY_PENDING_ROLE_COOKIE)?.value
  if (!key) return { joinedLabel: null, error: null }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return { joinedLabel: null, error: null }
  const profile = await prisma.candidateProfile.findFirst({ where: { userId: user.id }, select: { id: true } })
  if (!profile) return { joinedLabel: null, error: null }

  const domain = networkCookieDomain((await headers()).get('host'))
  jar.delete({ name: PENDING_NETWORK_COOKIE, path: '/', domain })
  jar.delete({ name: LEGACY_PENDING_ROLE_COOKIE, path: '/', domain })

  const result = await joinNetwork(profile.id, key)
  captureServerEvent(profile.id, 'network_joined', { networkKind: networkInfo(key)?.kind ?? null, networkKey: key, source: 'page', ok: result.ok })
  if (!result.ok) return { joinedLabel: null, error: result.error }
  revalidatePath('/dashboard/community')
  return { joinedLabel: result.info.networkName, error: null }
}
