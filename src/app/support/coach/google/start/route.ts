import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { coachGoogleEnabled } from '@/lib/coach/google/config'
import { buildCoachAuthUrl } from '@/lib/coach/google/oauth'
import { mintCoachOAuthState } from '@/lib/coach/google/state'
import { captureServerEvent } from '@/lib/posthog/server'

const BACK = '/support/coach/booking'

// Coach-gated: only a signed-in coach can mint the signed state the callback requires. Off unless both
// COACH_GOOGLE_CLIENT_ID and COACH_GOOGLE_CLIENT_SECRET are set, in which case nothing changes for anyone.
export async function GET(request: NextRequest) {
  const coach = await getCurrentCoach()
  if (!coachGoogleEnabled()) {
    captureServerEvent(coach.id, 'coach_google_connect_unavailable', { coachId: coach.id })
    return NextResponse.redirect(new URL(`${BACK}?googleError=not_available`, request.url))
  }
  try {
    const state = mintCoachOAuthState(coach.id)
    captureServerEvent(coach.id, 'coach_google_connect_started', { coachId: coach.id })
    return NextResponse.redirect(buildCoachAuthUrl(state, coach.workEmail))
  } catch (error) {
    console.error('Coach Google connect could not start:', error)
    return NextResponse.redirect(new URL(`${BACK}?googleError=not_available`, request.url))
  }
}
