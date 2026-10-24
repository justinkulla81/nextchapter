import { NextRequest, NextResponse } from 'next/server'
import { coachGoogleEnabled, hasRequiredScopes } from '@/lib/coach/google/config'
import { exchangeCoachCode } from '@/lib/coach/google/oauth'
import { verifyCoachOAuthState } from '@/lib/coach/google/state'
import { saveCoachConnection } from '@/lib/coach/google/connection'
import { fetchGoogleUserEmail } from '@/lib/google/oauth'
import { captureServerEvent } from '@/lib/posthog/server'

const BACK = '/support/coach/booking'

// The state is a signed, expiring blob minted by /start (see src/lib/coach/google/state.ts). This route does not read
// the coach's session cookie, because Google redirects to the host in NEXT_PUBLIC_APP_URL, which may not hold it.
export async function GET(request: NextRequest) {
  const to = (query: string) => NextResponse.redirect(new URL(`${BACK}?${query}`, request.url))
  if (!coachGoogleEnabled()) return to('googleError=not_available')

  const verified = verifyCoachOAuthState(request.nextUrl.searchParams.get('state'))
  // Forged, expired or missing state: never exchange the code.
  if (!verified) return to('googleError=invalid_state')
  const { coachId } = verified

  const code = request.nextUrl.searchParams.get('code')
  if (request.nextUrl.searchParams.get('error') || !code) {
    captureServerEvent(coachId, 'coach_google_connect_failed', { coachId, reason: 'denied' })
    return to('googleError=denied')
  }

  try {
    const tokens = await exchangeCoachCode(code)
    if (!tokens.refresh_token) {
      captureServerEvent(coachId, 'coach_google_connect_failed', { coachId, reason: 'no_refresh_token' })
      return to('googleError=no_refresh_token')
    }
    // Google lets people untick permissions and still "succeeds"; a grant without both calendar scopes would replace a working
    // connection with one that cannot check busy time or create events.
    if (!hasRequiredScopes(tokens.scope)) {
      captureServerEvent(coachId, 'coach_google_connect_failed', { coachId, reason: 'missing_scopes' })
      return to('googleError=missing_scopes')
    }
    const email = (await fetchGoogleUserEmail(tokens.access_token)).toLowerCase()
    await saveCoachConnection({ coachId, email, tokens: { ...tokens, refresh_token: tokens.refresh_token } })
    captureServerEvent(coachId, 'coach_google_connected', { coachId, googleEmail: email })
    return to('googleConnected=1')
  } catch (error) {
    console.error('Coach Google callback failed:', error instanceof Error ? error.message : 'unknown error')
    captureServerEvent(coachId, 'coach_google_connect_failed', { coachId, reason: 'exchange_failed' })
    return to('googleError=exchange_failed')
  }
}
