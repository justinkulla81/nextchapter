import { NextRequest, NextResponse } from 'next/server'
import { looksLikeScanner } from '@/lib/booking'
import { captureServerEvent } from '@/lib/posthog/server'

/**
 * The short link for feedback-call outreach (launchyournextchapter.com/call). It goes straight to the Google
 * booking page and counts the click first, since Google's page can't report anything back. `a` is the gift amount
 * the email offered and `s` a label for the list; neither says anything about the recipient.
 * Until FEEDBACK_CALL_URL is set it sends people to the explainer page instead.
 */
export function GET(request: NextRequest) {
  const a = Number(request.nextUrl.searchParams.get('a') ?? '')
  const s = (request.nextUrl.searchParams.get('s') ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)
  const target = process.env.FEEDBACK_CALL_URL
  captureServerEvent('feedback-call-link', 'feedback_call_link_clicked', {
    amount: [75, 100, 150].includes(a) ? a : null,
    source: s || null,
    audience: 'workforce_development',
    likelyScanner: looksLikeScanner(request.headers.get('user-agent')),
    destination: target ? 'calendar' : 'page',
  })
  return NextResponse.redirect(target || new URL('/feedback-call' + request.nextUrl.search, request.url), 302)
}
