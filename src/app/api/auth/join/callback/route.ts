import { NextRequest, NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { signInVerifiedEmail } from '@/lib/auth/verified-email-session'
import { adoptAnonymousProfile } from '@/lib/auth/adopt-anonymous-profile'
import { checkGoogleGrant, decodeIdTokenClaims } from '@/lib/google/grant'
import { exchangeCodeForTokens, isGmailTrackingTester, notifyAdminGmailAccessNeeded } from '@/lib/email-tracking/gmail-oauth'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { scanPlatformHistory } from '@/lib/platforms/backfill'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { applyJourneyChange } from '@/lib/journey/apply'
import { maybeNotifyAdminOfNewCandidate } from '@/lib/email/send-admin-new-candidate-account'
import { flowOfProfile, isOnboardingBundlesOn } from '@/lib/onboarding/flag'
import { getJoinRedirectUri } from '@/lib/onboarding/join-oauth'
import { consumeJoinState } from '@/lib/onboarding/join-state'
import { progressOf, progressPatch } from '@/lib/onboarding/progress'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { captureServerEvent } from '@/lib/posthog/server'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'

// The first inbox read is backgrounded with after() below and can run long on a heavy mailbox, so this gets the
// same headroom as the Connect Gmail callback.
export const maxDuration = 300

const CONNECT_PAGE = '/onboarding/connect'

// Where Google sends a visitor back after "Continue with Google", the required last step of the onboarding question
// bundles. One verified Google sign-in does three things: it creates (or signs in) the account for that email, moves
// the answers the visitor already gave onto it, and connects Gmail and Calendar and starts the first read.
export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url))
  const fail = (code: string) => go(`${CONNECT_PAGE}?error=${code}`)

  if (!isOnboardingBundlesOn(null)) return go('/onboarding')
  // Off until CASA (src/lib/google/connect-switch.ts): no one should arrive here, and nothing is read from a stray return.
  if (!isGoogleConnectOn()) return go('/onboarding/create-account')

  // The nonce from this browser's own start. Without it the callback may be an attacker's code fed to a victim, so
  // stop before exchanging anything.
  if (!(await consumeJoinState(request.nextUrl.searchParams.get('state')))) return fail('invalid_state')

  const code = request.nextUrl.searchParams.get('code')
  if (request.nextUrl.searchParams.get('error') || !code) return fail('denied')

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(code, getJoinRedirectUri())
  } catch (error) {
    console.error('Onboarding Google token exchange failed:', error)
    return fail('exchange_failed')
  }

  // Both permissions granted, and a personal Gmail account (a Workspace account carries an hd claim).
  const grant = checkGoogleGrant({ scope: tokens.scope, idToken: tokens.id_token, requirePersonal: true, requires: 'connect' })
  if (!grant.ok) return fail(grant.problem)

  const claims = decodeIdTokenClaims(tokens.id_token)
  const email = claims?.email?.trim().toLowerCase()
  if (!claims || !email) return fail('no_identity')

  // Who the visitor is right now: an anonymous session holding the answers they gave. Read before signing in, which
  // replaces the session.
  const supabase = await createClient()
  const {
    data: { user: before },
  } = await supabase.auth.getUser()
  const anonymousUserId = before?.is_anonymous ? before.id : null

  const signedIn = await signInVerifiedEmail(email, { admin: createAdminClient(), session: supabase })
  if (!signedIn.ok) return fail(signedIn.reason)

  // An admin, recruiter, coach or employer who lands here goes to their own portal instead of picking up a stray
  // candidate profile.
  await redirectIfNotCandidate(signedIn.userId, email)

  // Their answers come with them. If this Google account already has its own profile, that one is left untouched.
  const adopted = anonymousUserId ? await adoptAnonymousProfile(anonymousUserId, signedIn.userId) : 'none'

  const cookieStore = await cookies()
  let profile = await getOrCreateCandidateProfile(signedIn.userId, { coachId: cookieStore.get('nc_coach')?.value })

  const identity: Prisma.CandidateProfileUpdateInput = {}
  if (!profile.email) identity.email = email
  if (!profile.firstName && claims.given_name) identity.firstName = claims.given_name
  if (!profile.lastName && claims.family_name) identity.lastName = claims.family_name
  // A Google sign-in is a durable way back in, same as a linked Google identity.
  if (!profile.passwordSetAt) identity.passwordSetAt = new Date()
  if (Object.keys(identity).length > 0) {
    profile = await prisma.candidateProfile.update({ where: { id: profile.id }, data: identity }).catch((error) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error
      console.error('Failed to save sign-up identity:', error)
      return profile
    })
  }

  // The account exists and Google has confirmed its email, so registration completes now, through the same step every
  // other way of registering uses: duplicate-account check, lead source, identity matches. It also stamps the date that
  // keeps the first inbox read from earning Search Action points for mail that predates the account.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) profile = (await syncRegistrationCompletion(user, profile)).profile
  maybeNotifyAdminOfNewCandidate(profile.id).catch(() => {})
  // This email already belongs to another registered account: say so, rather than build a duplicate.
  if (profile.duplicateEmailBlockedAt) return go('/onboarding/create-account')

  // Connecting is limited, while Google's review is pending, to accounts on the tester list. Anyone else still gets
  // their account and is told tracking is waiting, and the admin is asked to approve them.
  let tracking: 'on' | 'pending' | 'off' = 'off'
  if (tokens.refresh_token) {
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

      // Backgrounded: a real inbox can be thousands of messages. The payoff page shows what has been found so far.
      // No Search Action points are awarded for connecting: setup is not search effort.
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

  // The Google step is done (the old optional reveal screen is no longer part of this flow).
  const inBundles = flowOfProfile(profile) === 'bundles'
  if (inBundles) {
    await applyJourneyChange(profile.id, { details: progressPatch(profile.journeyDetails, { googleRevealAt: new Date() }), source: 'ONBOARDING' })
  }

  captureServerEvent(profile.id, 'onboarding_google_completed', {
    candidateId: profile.id,
    isNewAccount: signedIn.isNew,
    answersCarriedOver: adopted === 'adopted',
    tracking,
    flow: 'bundles',
  })

  // A new member's next screen is the payoff; anyone further along goes wherever the hub sends them.
  const done = progressOf(profile.journeyDetails)
  if (inBundles && done.completed.includes('coach') && !done.finishedAt) return go(`/onboarding/finish?tracking=${tracking}`)
  return go('/onboarding')
}
