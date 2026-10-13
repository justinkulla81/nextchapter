'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendFriendReferralEmail } from '@/lib/email/send-friend-referral'
import { allowByIp, allowByTarget, DAY_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public, unauthenticated form — cap how many invites one referrer email
// can trigger per day so this can't be turned into an open mail relay.
const MAX_REFERRALS_PER_DAY = 5

export type ReferralFormState = { error?: string; success?: boolean } | undefined

export async function submitReferral(
  _prevState: ReferralFormState,
  formData: FormData
): Promise<ReferralFormState> {
  const friendEmail = (formData.get('friendEmail') as string | null)?.trim().toLowerCase()
  const yourEmail = (formData.get('yourEmail') as string | null)?.trim().toLowerCase()

  if (!friendEmail || !EMAIL_RE.test(friendEmail)) {
    return { error: "Please enter your friend's email address." }
  }
  if (!yourEmail || !EMAIL_RE.test(yourEmail)) {
    return { error: 'Please enter your own email address.' }
  }
  if (friendEmail === yourEmail) {
    return { error: "That's the same email twice — enter your friend's address." }
  }

  // The per-referrer quota below is keyed on a field the caller types, so
  // rotating it bypasses it. These two are keyed on what the caller can't vary:
  // their network, and the address that would receive the email.
  if (!(await allowByIp('refer', 10, DAY_MS))) return { error: RATE_LIMITED_MESSAGE }
  if (!(await allowByTarget('refer-friend', friendEmail, 2, DAY_MS))) {
    return { error: 'That address was already invited recently. Please try again tomorrow.' }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentByReferrer = await prisma.waitlistSignup.findMany({
    where: { audience: 'friend_referral', createdAt: { gte: since } },
    select: { payload: true },
  })
  const sentToday = recentByReferrer.filter(
    (row) => (row.payload as { yourEmail?: string })?.yourEmail === yourEmail
  ).length
  if (sentToday >= MAX_REFERRALS_PER_DAY) {
    return { error: "You've sent a lot of invites today — try again tomorrow." }
  }

  await prisma.waitlistSignup.create({
    data: { audience: 'friend_referral', payload: { friendEmail, yourEmail } },
  })

  const { sent } = await sendFriendReferralEmail({ friendEmail, referrerEmail: yourEmail })
  captureServerEvent(yourEmail, 'friend_referral_sent', { friendEmail, emailSent: sent })

  return { success: true }
}
