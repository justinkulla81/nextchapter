// CASA 2.4.1 (ASVS 3.7.1): an irreversible member action needs a fresh
// sign-in. "Fresh" means the session's last real authentication (its JWT
// `amr` entries: password, otp, oauth, ...) happened within the window below.
// The `amr` timestamp is when the person authenticated, not when the access
// token was last refreshed, so an hour-old tab with silently refreshed tokens
// does not count. Pure functions only, so tests can import them directly.

export const RECENT_AUTH_WINDOW_SECONDS = 10 * 60

type AmrEntry = { method?: unknown; timestamp?: unknown }

/** Seconds since epoch of the session's latest real sign-in, or null. Anonymous sign-ins don't count. */
export function lastAuthenticatedAt(claims: { amr?: unknown } | null | undefined): number | null {
  const amr = claims?.amr
  if (!Array.isArray(amr)) return null
  let latest: number | null = null
  for (const entry of amr as AmrEntry[]) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.method === 'anonymous') continue
    const t = typeof entry.timestamp === 'number' ? entry.timestamp : Number(entry.timestamp)
    if (Number.isFinite(t) && (latest === null || t > latest)) latest = t
  }
  return latest
}

export function isRecentAuth(
  claims: { amr?: unknown } | null | undefined,
  nowSeconds: number,
  windowSeconds = RECENT_AUTH_WINDOW_SECONDS,
): boolean {
  const at = lastAuthenticatedAt(claims)
  // A timestamp more than a minute in the future is not trusted either.
  return at !== null && at <= nowSeconds + 60 && nowSeconds - at <= windowSeconds
}

/** The emailed code as typed: digits only, 6 to 10 of them (Supabase's OTP length range), else null. */
export function normalizeOtp(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const digits = input.replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 10 ? digits : null
}

/** "j•••@gmail.com": enough to recognise the inbox, not enough to read it off a shoulder-surfed screen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 1)}•••@${domain}`
}
