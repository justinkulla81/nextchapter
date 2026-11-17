import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import type { NextResponse } from 'next/server'
import { getPersona } from '@/lib/constants/personas'
import { markerDomain } from '@/lib/auth/member-marker'
import { SERVER_COOKIES_SECURE } from '@/lib/supabase/cookie-options'

// The profile button in a lifecycle email. The link carries the address only inside the signed token (never in the URL as an address),
// /api/lead-profile/<token> turns it into a cookie, and the onboarding details step reads the cookie to prefill the email field.

export const LEAD_COOKIE = 'nc_lead'
export const LEAD_COOKIE_MAX_AGE = 14 * 24 * 60 * 60

/**
 * Where an email's profile button or situation button goes: the first onboarding question, with the situation they picked already
 * filled in (`situation=`, read by /onboarding/desire, because session storage does not cross from the main site to the candidate
 * host). No pick: the question as it is. Only this path, never a passed-in URL. It used to stop at /start/<journey> first, a page
 * that asked them to click on to a question they had already answered; all three who tapped a situation by 2026-11-17 left there.
 */
export function profileDestination(journey: string | null, params: URLSearchParams): string {
  const persona = getPersona(journey ?? '')
  const out = new URLSearchParams()
  if (persona) {
    out.set('goal', 'market-reality')
    out.set('situation', persona.situation)
  }
  for (const key of ['from', 'utm_source', 'utm_campaign']) {
    const value = params.get(key)
    if (value) out.set(key, value.slice(0, 80))
  }
  const query = out.toString()
  return query ? `/onboarding/desire?${query}` : '/onboarding/desire'
}

// Mail scanners open every link in a message; counting those would file everyone under the first link.
const SCANNER = /bot|crawler|spider|preview|proofpoint|barracuda|mimecast|googleimageproxy|microsoft office|safelinks/i

export function isMailScanner(userAgent: string | null): boolean {
  return !userAgent || SCANNER.test(userAgent)
}

/**
 * Remembers the signed address for the onboarding details step. On the whole site's domain: the email links land on the main site and
 * onboarding runs on the candidate host, so a host-only cookie never reached the details step and the email was never filled in.
 */
export function setLeadCookie(response: NextResponse, token: string): void {
  response.cookies.set(LEAD_COOKIE, token, { domain: markerDomain(process.env.NEXT_PUBLIC_APP_URL), httpOnly: true, sameSite: 'lax', secure: SERVER_COOKIES_SECURE, path: '/', maxAge: LEAD_COOKIE_MAX_AGE })
}

/** The address in a nc_lead cookie value, or null when it is missing or not signed by us. */
export function emailFromLeadCookie(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    return readUnsubscribeToken(value)?.email ?? null
  } catch {
    return null
  }
}
