import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { allowRequest, HOUR_MS } from '@/lib/security/rate-limit'
import { sendReauthCodeEmail } from '@/lib/email/send-reauth-code'
import { isRecentAuth, maskEmail, normalizeOtp } from './recent-auth'

// Re-authentication before an irreversible member action (CASA 2.4.1).
//
// Passes straight through when the member signed in within the last 10
// minutes. Otherwise it emails a one-time code and the form asks for it; the
// next submit carries the code (`reauthCode`), which Supabase verifies as an
// email OTP. That verification also issues a fresh session, so a second
// sensitive action right after doesn't ask again.
//
// The code is Supabase's own (admin generateLink → email_otp, verified with
// verifyOtp); we deliver it through Resend so the email is ours and does not
// depend on the Supabase magic-link template.

export type ReauthAction = 'delete_google_data' | 'deactivate_account'

export type ReauthChallenge = { sentTo: string; error?: string }

export type ReauthOutcome =
  | { status: 'ok'; method: 'recent_session' | 'email_code' }
  | { status: 'challenge'; challenge: ReauthChallenge }

const ACTION_LABEL: Record<ReauthAction, string> = {
  delete_google_data: 'delete your Google data',
  deactivate_account: 'deactivate your account',
}

// Per member, not per IP: five codes an hour is plenty for a person and
// stops a stolen session from mail-bombing the account owner.
const CODES_PER_HOUR = 5

async function sendCode(user: User, action: ReauthAction): Promise<'sent' | 'limited' | 'failed'> {
  if (!user.email) return 'failed'
  if (!(await allowRequest({ bucket: 'reauth-code', key: user.id, limit: CODES_PER_HOUR, windowMs: HOUR_MS }))) return 'limited'
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: user.email })
  const code = data?.properties?.email_otp
  if (error || !code) {
    console.error('Re-auth code could not be generated:', error?.message ?? 'no email_otp')
    return 'failed'
  }
  return (await sendReauthCodeEmail({ to: user.email, code, actionLabel: ACTION_LABEL[action] })) ? 'sent' : 'failed'
}

export async function ensureRecentAuth(opts: {
  supabase: SupabaseClient
  user: User
  formData: FormData
  action: ReauthAction
  distinctId: string
  now?: Date
}): Promise<ReauthOutcome> {
  const { supabase, user, formData, action, distinctId } = opts
  const email = user.email ?? null
  const sentTo = email ? maskEmail(email) : 'your email'
  const resend = formData.get('reauthResend') === '1'
  const code = resend ? null : normalizeOtp(formData.get('reauthCode'))

  if (code && email) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (!error) {
      captureServerEvent(distinctId, 'reauth_challenge_passed', { action, method: 'email_code' })
      return { status: 'ok', method: 'email_code' }
    }
    captureServerEvent(distinctId, 'reauth_code_rejected', { action })
    return {
      status: 'challenge',
      challenge: { sentTo, error: 'That code didn’t work. It may be mistyped, used already, or expired. Check the newest email from us, or send a new code.' },
    }
  }

  const { data } = await supabase.auth.getClaims()
  if (isRecentAuth(data?.claims, Math.floor((opts.now ?? new Date()).getTime() / 1000))) {
    captureServerEvent(distinctId, 'reauth_challenge_passed', { action, method: 'recent_session' })
    return { status: 'ok', method: 'recent_session' }
  }

  const sent = await sendCode(user, action)
  captureServerEvent(distinctId, 'reauth_challenge_shown', { action, resend, delivery: sent })
  const fallback = 'You can also log out, log back in, and do this within 10 minutes.'
  return {
    status: 'challenge',
    challenge: {
      sentTo,
      error:
        sent === 'sent'
          ? undefined
          : sent === 'limited'
            ? `We’ve sent several codes in the last hour, so we’re not sending another yet. Use the newest one, or try again later. ${fallback}`
            : `We couldn’t send a code just now. ${fallback}`,
    },
  }
}
