// Pure rules for the sign-up confirmation callback (components/auth/CallbackHandler.tsx), kept here so they are tested.
//
// The confirmation link lands on /auth/callback?code=... . supabase-js reads that code by itself the moment the browser client
// starts and uses up the one-time PKCE verifier; the handler then called exchangeCodeForSession(code) a second time, which fails
// with "PKCE code verifier not found" even though the first exchange succeeded and the session exists. The visitor saw "This link
// is invalid or has expired" while already confirmed and signed in, and was never sent on to onboarding.

/** True for the error supabase-js raises when the one-time verifier is gone (used up, or the link was opened in another browser). */
export function isVerifierMissing(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.name === 'AuthPKCECodeVerifierMissingError' || /code verifier/i.test(error.message ?? '')
}

interface SessionLike {
  user: { is_anonymous?: boolean; last_sign_in_at?: string | null }
}

/**
 * Whether this session is the one the confirmation link has just created: a real (not anonymous) account that signed in within
 * the last minute. Used to tell "the first exchange worked" apart from "the link was opened in a different browser", where the
 * visitor has no session, or only an anonymous or older one, and the error is real.
 */
export function signedInJustNow(session: SessionLike | null | undefined, now: number = Date.now(), windowMs = 60_000): boolean {
  if (!session || session.user.is_anonymous) return false
  const at = session.user.last_sign_in_at ? Date.parse(session.user.last_sign_in_at) : NaN
  return Number.isFinite(at) && now - at >= -5_000 && now - at <= windowMs
}
