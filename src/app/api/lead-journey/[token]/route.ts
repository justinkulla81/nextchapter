import { NextResponse, type NextRequest } from 'next/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { getPersona } from '@/lib/constants/personas'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { DEFAULT_JOURNEY } from '@/lib/leads/infer-journey'
import { recordLeadJourney } from '@/lib/leads/lifecycle/journey'

// Mail scanners open every link in a message; counting those would file everyone under the first button.
const SCANNER = /bot|crawler|spider|preview|proofpoint|barracuda|mimecast|googleimageproxy|microsoft office|safelinks/i

/** A journey button in a lifecycle email. Saves the answer against the address in the signed token, then opens /start/<journey>. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const slug = getPersona(request.nextUrl.searchParams.get('p') ?? '')?.slug ?? DEFAULT_JOURNEY
  const step = request.nextUrl.searchParams.get('step') ?? 'welcome'
  try {
    const who = readUnsubscribeToken(token)
    const agent = request.headers.get('user-agent') ?? ''
    if (who && agent && !SCANNER.test(agent)) {
      await recordLeadJourney(who.email, slug)
      captureServerEvent(who.email, 'lead_journey_chosen', { journey: slug, step, via: 'lifecycle_email' })
    }
  } catch (error) {
    console.error('lead journey failed:', error instanceof Error ? error.message : error)
  }
  return NextResponse.redirect(new URL(`/start/${slug}?from=lead_email&utm_source=lead_email&utm_campaign=journey_${step}`, request.url))
}
