import { NextRequest, NextResponse } from 'next/server'
import { isOnboardingBundlesOn } from '@/lib/onboarding/flag'
import { buildJoinAuthUrl } from '@/lib/onboarding/join-oauth'
import { storeJoinState } from '@/lib/onboarding/join-state'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'

// Sends a visitor to Google to create their account and connect Gmail and Calendar, the required last step of the
// onboarding question bundles. With the bundles switch off this does nothing but hand them back to onboarding.
export async function GET(request: NextRequest) {
  if (!isOnboardingBundlesOn(null)) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
  // Off until CASA (src/lib/google/connect-switch.ts): the account is created with an email and a password.
  if (!isGoogleConnectOn()) {
    return NextResponse.redirect(new URL('/onboarding/create-account', request.url))
  }

  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/onboarding/connect?error=not_configured', request.url))
  }

  const state = await storeJoinState()
  return NextResponse.redirect(buildJoinAuthUrl(state, clientId))
}
