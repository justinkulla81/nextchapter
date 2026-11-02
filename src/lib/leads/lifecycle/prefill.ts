import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { getPersona } from '@/lib/constants/personas'

// The profile button in a lifecycle email. The link carries the address only inside the signed token (never in the URL as an address),
// /api/lead-profile/<token> turns it into a cookie, and the onboarding details step reads the cookie to prefill the email field.

export const LEAD_COOKIE = 'nc_lead'
export const LEAD_COOKIE_MAX_AGE = 14 * 24 * 60 * 60

/** Where the button goes: the journey's page when they picked one, else the situation question. Only these two paths, never a passed-in URL. */
export function profileDestination(journey: string | null, params: URLSearchParams): string {
  const slug = getPersona(journey ?? '')?.slug
  const path = slug ? `/start/${slug}` : '/onboarding/desire'
  const out = new URLSearchParams()
  for (const key of ['from', 'utm_source', 'utm_campaign']) {
    const value = params.get(key)
    if (value) out.set(key, value.slice(0, 80))
  }
  const query = out.toString()
  return query ? `${path}?${query}` : path
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
