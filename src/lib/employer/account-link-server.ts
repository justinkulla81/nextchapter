import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowByTarget, allowRequest } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { urlForAppPath } from '@/lib/portal-hosts'
import { sendAccountLinkEmail } from '@/lib/email/send-account-link'
import { maskEmail } from '@/lib/auth/recent-auth'
import { listAllAuthUsers } from '@/lib/admin/auth-users'
import {
  LINK_TOKEN_TTL_MS,
  confirmAccountLink,
  linkedBridgeIdentity,
  listAccountLinks,
  removeAccountLink,
  requestAccountLink,
  type LinkSummary,
} from '@/lib/employer/account-link'

// Real wiring for src/lib/employer/account-link.ts: the database, Supabase auth, mail, the rate limiter and PostHog.
// Events carry ids only, never an email.

/** The auth account's email when it exists and has been confirmed; null otherwise. */
async function verifiedEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
    if (error || !data.user?.email || !data.user.email_confirmed_at) return null
    return data.user.email
  } catch {
    return null
  }
}

const partyVerified = async (userId: string) => (await verifiedEmail(userId)) !== null

async function findUserIdByEmail(email: string): Promise<string | null> {
  // Supabase has no lookup by email in the admin API; this scans the (small, capped) user list. Used only for a rate-limited,
  // signed-in request, never on a page load.
  const users = await listAllAuthUsers()
  for (const u of users.values()) if (u.email?.toLowerCase() === email) return u.id
  return null
}

export async function requestLinkFor(user: { id: string; email: string | null }, otherEmail: unknown) {
  const result = await requestAccountLink(
    prisma,
    { userId: user.id, ownEmail: user.email, otherEmail },
    {
      findUserIdByEmail,
      partyVerified,
      // The target address is hashed by allowByTarget, so no raw email lands in the limiter table.
      allow: (bucket, key, limit, windowMs) => (bucket === 'employer-link-target' ? allowByTarget(bucket, key, limit, windowMs) : allowRequest({ bucket, key, limit, windowMs })),
      sendEmail: ({ to, token, requesterEmail }) =>
        sendAccountLinkEmail({ to, requesterEmail, minutes: LINK_TOKEN_TTL_MS / 60000, url: urlForAppPath(`/employer-home/link?token=${encodeURIComponent(token)}`) }),
    },
  )
  captureServerEvent(user.id, 'employer_account_link_requested', { userId: user.id, linkId: result.ok ? result.linkId : null, result: result.ok ? 'sent' : result.reason })
  return result
}

export async function confirmLinkFor(user: { id: string }, token: string) {
  const result = await confirmAccountLink(prisma, { userId: user.id, token }, { partyVerified })
  if (result.ok) captureServerEvent(user.id, 'employer_account_link_verified', { userId: user.id, otherUserId: result.otherUserId, linkId: result.linkId })
  return result
}

export async function removeLinkFor(user: { id: string }, linkId: string) {
  const removed = await removeAccountLink(prisma, { userId: user.id, linkId })
  if (removed) captureServerEvent(user.id, 'employer_account_link_removed', { userId: user.id, linkId, wasActive: removed.wasActive })
  return removed
}

export interface LinkView extends LinkSummary {
  /** The other account's address with the middle hidden, so the person can recognise it. */
  maskedEmail: string | null
}

/** Fail soft: if the table is missing the panel is simply hidden (available false). */
export async function linkViewsFor(userId: string): Promise<{ available: boolean; links: LinkView[] }> {
  try {
    const links = await listAccountLinks(prisma, userId)
    const views = await Promise.all(
      links.map(async (l) => {
        try {
          const { data } = await createAdminClient().auth.admin.getUserById(l.otherUserId)
          return { ...l, maskedEmail: data.user?.email ? maskEmail(data.user.email) : null }
        } catch {
          return { ...l, maskedEmail: null }
        }
      }),
    )
    return { available: true, links: views }
  } catch {
    return { available: false, links: [] }
  }
}

/** For the bridge: the linked account's verified email, only while an active link joins the two people. */
export function linkedIdentityFor(userId: string, linkedUserId: string) {
  return linkedBridgeIdentity(prisma, { userId, linkedUserId }, { verifiedEmail })
}
