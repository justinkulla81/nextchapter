import { NextResponse, type NextRequest } from 'next/server'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { LEAD_COOKIE, LEAD_COOKIE_MAX_AGE, profileDestination } from '@/lib/leads/lifecycle/prefill'

/**
 * The "Create my free profile" button in a lifecycle email. A valid signed token sets a short-lived cookie so the onboarding details
 * step can prefill the email, then the visitor goes on to their journey page (or the situation question). A bad or missing token
 * just goes on without the cookie.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const search = request.nextUrl.searchParams
  const response = NextResponse.redirect(new URL(profileDestination(search.get('j'), search), request.url))
  let who: ReturnType<typeof readUnsubscribeToken> = null
  try {
    who = readUnsubscribeToken(token)
  } catch {
    who = null
  }
  if (who) {
    response.cookies.set(LEAD_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: LEAD_COOKIE_MAX_AGE })
  }
  return response
}
