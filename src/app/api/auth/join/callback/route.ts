import { NextRequest, NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { signInVerifiedEmail } from '@/lib/auth/verified-email-session'
import { checkGoogleGrant, decodeIdTokenClaims } from '@/lib/google/grant'
import {
  exchangeCodeForTokens,
  isGmailTrackingTester,
  notifyAdminGmailAccessNeeded,
} from '@/lib/email-tracking/gmail-oauth'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { scanPlatformHistory } from '@/lib/platforms/backfill'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { isOnboardingV2ConnectEnabled, isOnboardingV2Enabled } from '@/lib/onboarding/v2-flag'
import { consumeJoinState } from '@/lib/onboarding/join-state'
import { getJoinRedirectUri } from '@/lib/onboarding/join-oauth'
import { captureServerEvent } from '@/lib/posthog/server'

// The first inbox read is backgrounded with after() below and can run long on a
// heavy mailbox, so this gets the same headroom as the Connect Gmail callback.
export const maxDuration = 300

// Where Google sends a visitor back after sign-up (onboarding v2). Verified by
// the ID token from Google's own token endpoint: it creates or signs in the
// account for that email, then starts reading the inbox if Gmail was granted.
export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url))
  const fail = (code: string) => go(`/onboarding/join?error=${code}`)

  if (!isOnboardingV2Enabled()) return go('/onboarding/desire')

  // The nonce from this browser's own start. Without it the callback may be an
  // attacker's code fed to a victim, so stop before exchanging anything.
  if (!(await consumeJoinState(request.nextUrl.searchParams.get('state')))) return fail('invalid_state')

  const code = request.nextUrl.searchParams.get('code')
  if (request.nextUrl.searchParams.get('error') || !code) return fail('denied')

  const connect = isOnboardingV2ConnectEnabled()

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(code, getJoinRedirectUri())
  } catch (error) {
    console.error('Sign-up Google token exchange failed:', error)
    return fail('exchange_failed')
  }

  const grant = checkGoogleGrant({
    scope: tokens.scope,
    idToken: tokens.id_token,
    requirePersonal: true,
    requires: connect ? 'connect' : 'identity',
  })
  if (!grant.ok) return fail(grant.problem)

  const claims = decodeIdTokenClaims(tokens.id_token)
  const email = claims?.email?.trim().toLowerCase()
  if (!claims || !email) return fail('no_identity')

  const signedIn = await signInVerifiedEmail(email, { admin: createAdminClient(), session: await createClient() })
  if (!signedIn.ok) return fail(signedIn.reason)

  // An admin, recruiter, coach or employer who lands here goes to their own
  // portal instead of picking up a stray candidate profile.
  await redirectIfNotCandidate(signedIn.userId, email)

  const cookieStore = await cookies()
  const profile = await getOrCreateCandidateProfile(signedIn.userId, { coachId: cookieStore.get('nc_coach')?.value })

  // The account exists and its email is confirmed by Google, so registration is
  // complete now. Stamping it here (not after the situation question) is also
  // what keeps the first inbox read from earning Search Action points for mail
  // that predates the account: sync-gmail.ts floors those on this timestamp.
  const identity: Prisma.CandidateProfileUpdateInput = {}
  if (!profile.email) identity.email = email
  if (!profile.firstName && claims.given_name) identity.firstName = claims.given_name
  if (!profile.lastName && claims.family_name) identity.lastName = claims.family_name
  if (!profile.registrationCompletedAt) identity.registrationCompletedAt = new Date()
  // A Google sign-in is a durable way back in, same as a linked Google identity.
  if (!profile.passwordSetAt) identity.passwordSetAt = new Date()
  if (Object.keys(identity).length > 0) {
    await prisma.candidateProfile.update({ where: { id: profile.id }, data: identity }).catch((error) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error
      console.error('Failed to save sign-up identity:', error)
    })
  }

  // Connecting is part of the same consent, but it is only switched on for
  // accounts Google's testing mode and our allow-list currently permit.
  let tracking: 'on' | 'pending' | 'off' = 'off'
  if (connect && tokens.refresh_token) {
    if (!(await isGmailTrackingTester(email))) {
      notifyAdminGmailAccessNeeded(email).catch((error) => console.error('Failed to notify admin of Gmail access request:', error))
      tracking = 'pending'
    } else {
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
      const tokenFields = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt }
      const [emailConnection, calendarConnection] = await Promise.all([
        prisma.emailConnection.upsert({
          where: { candidateId: profile.id },
          create: { candidateId: profile.id, ...tokenFields, connectedEmail: email },
          update: { ...tokenFields, disconnectedAt: null, needsReconnectAt: null, connectedEmail: email },
        }),
        prisma.calendarConnection.upsert({
          where: { candidateId: profile.id },
          create: { candidateId: profile.id, ...tokenFields },
          update: { ...tokenFields, disconnectedAt: null, needsReconnectAt: null },
        }),
      ])

      // Backgrounded: a real inbox can be thousands of messages. The reveal page
      // polls how far this has got. No Search Action points are awarded for
      // connecting: setup is not search effort.
      after(() =>
        Promise.all([
          syncGmailConnection(emailConnection.id)
            .catch((error) => console.error('Initial Gmail sync failed:', error))
            .then(() => scanPlatformHistory(profile.id, emailConnection.id)),
          syncGoogleCalendarConnection(calendarConnection.id).catch((error) => console.error('Initial Calendar sync failed:', error)),
        ]),
      )
      tracking = 'on'
    }
  }

  captureServerEvent(profile.id, 'onboarding_google_completed', {
    isNewAccount: signedIn.isNew,
    asked: connect ? 'sign_in_and_inbox' : 'sign_in_only',
    tracking,
  })
  if (signedIn.isNew) captureServerEvent(profile.id, 'account_created', { method: 'google' })

  // Someone already part-way through (or done with) onboarding goes wherever
  // the hub sends them; a brand-new member sees what we found.
  if (profile.assessmentComplete) return go('/onboarding')
  return go(`/onboarding/reveal?tracking=${tracking}`)
}
