import { NextRequest, NextResponse } from 'next/server'
import { BOOKING_URL, looksLikeScanner } from '@/lib/booking'
import { captureServerEvent } from '@/lib/posthog/server'

/**
 * The booking link used in outreach follow-ups. It exists so a click can be
 * counted before the visitor lands on Google's page, which can't report
 * anything back. `t` is the email template and `s` the step (2 or 3); neither
 * says anything about the recipient.
 */
export function GET(request: NextRequest) {
  const t = (request.nextUrl.searchParams.get('t') ?? '').slice(0, 40)
  const s = Number(request.nextUrl.searchParams.get('s') ?? '')
  captureServerEvent('booking-link', 'booking_link_clicked', {
    template: t || null,
    step: Number.isInteger(s) ? s : null,
    likelyScanner: looksLikeScanner(request.headers.get('user-agent')),
  })
  // Permanent by owner decision (2026-11-17). no-store keeps browsers from caching the 308, so every click still reaches
  // this route and is counted, and a new BOOKING_URL takes effect at once.
  const res = NextResponse.redirect(BOOKING_URL, 308)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
