'use client'

// A same-browser fallback for routing a fresh recruiter/employer/coach
// signup to the right portal after they click their email confirmation
// link. The primary mechanism is the `?next=` query param on the
// emailRedirectTo URL (see CallbackHandler), which Supabase does preserve
// end-to-end in normal use — but corporate email security scanners and
// link-rewriting proxies occasionally mangle or drop query strings on
// outbound links. This cookie is set the moment signUp() is called and
// read back by CallbackHandler on the same device/browser, so the correct
// portal still gets picked even if the URL param doesn't survive the round
// trip through the user's inbox.

const COOKIE_NAME = 'nc_pending_signup_role'
const MAX_AGE_SECONDS = 60 * 60 // matches how long a confirmation link stays clickable

export type PendingSignupRole = 'recruiter' | 'employer' | 'coach' | 'hiring' | 'crucible-employer' | 'eqoveriq-contributor'

export function setPendingSignupRoleCookie(role: PendingSignupRole) {
  document.cookie = `${COOKIE_NAME}=${role}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`
}

export function readPendingSignupRoleCookie(): PendingSignupRole | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  const value = match ? decodeURIComponent(match[1]) : null
  return value === 'recruiter' ||
    value === 'employer' ||
    value === 'coach' ||
    value === 'hiring' ||
    value === 'crucible-employer' ||
    value === 'eqoveriq-contributor'
    ? value
    : null
}

export function clearPendingSignupRoleCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
}
