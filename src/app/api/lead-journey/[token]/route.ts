import { NextResponse, type NextRequest } from 'next/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { getPersona } from '@/lib/constants/personas'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { DEFAULT_JOURNEY } from '@/lib/leads/infer-journey'
import { recordLeadJourney } from '@/lib/leads/lifecycle/journey'
import { isMailScanner, profileDestination, setLeadCookie } from '@/lib/leads/lifecycle/prefill'

/**
 * A journey button in a lifecycle email. Saves the answer against the address in the signed token, remembers the address for the
 * details step, then opens the first onboarding question with that answer filled in.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const slug = getPersona(request.nextUrl.searchParams.get('p') ?? '')?.slug ?? DEFAULT_JOURNEY
  const step = request.nextUrl.searchParams.get('step') ?? 'welcome'
  const dest = profileDestination(slug, new URLSearchParams({ from: 'lead_email', utm_source: 'lead_email', utm_campaign: `journey_${step}` }))
  const response = NextResponse.redirect(new URL(dest, request.url))
  try {
    const who = readUnsubscribeToken(token)
    if (who) {
      setLeadCookie(response, token)
      if (!isMailScanner(request.headers.get('user-agent'))) {
        await recordLeadJourney(who.email, slug)
        captureServerEvent(who.email, 'lead_journey_chosen', { journey: slug, step, via: 'lifecycle_email' })
      }
    }
  } catch (error) {
    console.error('lead journey failed:', error instanceof Error ? error.message : error)
  }
  return response
}
