import { NextRequest, NextResponse } from 'next/server'
import { isOnboardingV2ConnectEnabled, isOnboardingV2Enabled } from '@/lib/onboarding/v2-flag'
import { buildJoinAuthUrl } from '@/lib/onboarding/join-oauth'
import { storeJoinState } from '@/lib/onboarding/join-state'

// Sends a visitor to Google to sign up or sign in (onboarding v2). With the
// flag off this does nothing but hand them to the classic first step.
export async function GET(request: NextRequest) {
  if (!isOnboardingV2Enabled()) {
    return NextResponse.redirect(new URL('/onboarding/desire', request.url))
  }

  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/onboarding/join?error=not_configured', request.url))
  }

  const state = await storeJoinState()
  return NextResponse.redirect(buildJoinAuthUrl(state, isOnboardingV2ConnectEnabled(), clientId))
}
