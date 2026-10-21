import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VerifiedEmailSignIn =
  | { ok: true; userId: string; isNew: boolean }
  | { ok: false; reason: 'unconfirmed_account' | 'session_failed' }

// Starts a Supabase session for an email address Google has already verified
// (the ID token came straight from Google's token endpoint with
// email_verified true). It does not need Supabase's Google provider to be
// configured: it creates the user if there isn't one, mints a one-time link
// with the admin API, and redeems it with the request's own client so the
// session cookies land on this response.
//
// An existing account is only signed into when its email was already
// confirmed. An unconfirmed one may have been registered by someone else with
// a password they know, and signing the real owner into it would hand that
// person the account (pre-registration takeover), so it is refused.
export async function signInVerifiedEmail(
  email: string,
  deps: { admin: SupabaseClient; session: SupabaseClient },
): Promise<VerifiedEmailSignIn> {
  const { admin, session } = deps

  const created = await admin.auth.admin.createUser({ email, email_confirm: true })
  const isNew = !created.error
  if (created.error) {
    const exists = created.error.code === 'email_exists' || /already (been )?registered|already exists/i.test(created.error.message)
    if (!exists) return { ok: false, reason: 'session_failed' }
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash || !link.data?.user) return { ok: false, reason: 'session_failed' }

  if (!isNew && !link.data.user.email_confirmed_at) return { ok: false, reason: 'unconfirmed_account' }

  const verified = await session.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  const userId = verified.data?.user?.id
  if (verified.error || !userId) return { ok: false, reason: 'session_failed' }

  return { ok: true, userId, isNew }
}
