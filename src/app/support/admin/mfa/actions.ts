'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgUser } from '@/lib/supabase/get-current-user'
import { requireAdminSession } from '@/lib/admin/auth'
import { aalOf } from '@/lib/admin/mfa'
import { captureServerEvent } from '@/lib/posthog/server'

// Two-step login (Supabase TOTP) for the admin portal and, for NextChapter
// admins, the college/workforce org portal. Each portal has its own session
// cookie, so the factor is verified against that portal's session. The
// factor itself belongs to the Supabase user, so one enrollment serves both.

export type MfaPortal = 'admin' | 'org'

type Fail = { ok: false; error: string }

async function sessionFor(portal: unknown) {
  if (portal === 'admin') {
    const { user } = await requireAdminSession()
    return { supabase: await createClient('admin'), user, portal: 'admin' as const }
  }
  if (portal === 'org') {
    const user = await getOrgUser()
    if (!user) redirect('/i/login?next=/i/mfa')
    return { supabase: await createClient('org'), user, portal: 'org' as const }
  }
  throw new Error('Unknown portal')
}

const sixDigits = (code: unknown) => (typeof code === 'string' ? code.replace(/\D/g, '') : '')

export async function startTotpEnrollment(portal: MfaPortal): Promise<{ ok: true; factorId: string; qrCode: string; secret: string } | Fail> {
  const { supabase, user, portal: p } = await sessionFor(portal)
  // A set-up that was started and never finished leaves an unverified factor;
  // clear those so starting again always works.
  const { data: listed } = await supabase.auth.mfa.listFactors()
  for (const f of listed?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator added ${stamp} UTC`, issuer: 'NextChapter Admin' })
  if (error || !data || data.type !== 'totp') {
    // Supabase refuses a new factor from an aal1 session once one is verified.
    const needsCode = /aal2|assurance/i.test(error?.message ?? '')
    return { ok: false, error: needsCode ? 'Enter a code from the authenticator you already set up first, then add another.' : 'We couldn’t start the set-up. Try again in a minute.' }
  }
  captureServerEvent(user.id, 'admin_mfa_enroll_started', { portal: p })
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotp(portal: MfaPortal, factorId: string, code: string, enrolling: boolean): Promise<{ ok: true } | Fail> {
  const { supabase, user, portal: p } = await sessionFor(portal)
  const digits = sixDigits(code)
  if (digits.length !== 6) return { ok: false, error: 'Enter the 6-digit code your authenticator app shows right now.' }
  if (typeof factorId !== 'string' || !factorId) return { ok: false, error: 'Pick the authenticator to use, then enter its code.' }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: digits })
  if (error) {
    captureServerEvent(user.id, 'admin_mfa_verify_failed', { portal: p, enrolling })
    return { ok: false, error: 'That code didn’t match. Codes change every 30 seconds: enter the one showing now. If it keeps failing, check that your phone’s clock is set automatically.' }
  }
  captureServerEvent(user.id, enrolling ? 'admin_mfa_enrolled' : 'admin_mfa_verified', { portal: p })
  return { ok: true }
}

export async function removeTotpFactor(portal: MfaPortal, factorId: string): Promise<{ ok: true } | Fail> {
  const { supabase, user, portal: p } = await sessionFor(portal)
  const { data: claims } = await supabase.auth.getClaims()
  if (aalOf(claims?.claims) !== 'aal2') return { ok: false, error: 'Enter a code from your authenticator first.' }
  const { data: listed } = await supabase.auth.mfa.listFactors()
  const verified = listed?.totp ?? []
  // Never remove the last one here: that would turn two-step login off for
  // this account. Recovery for a lost phone is the Supabase dashboard.
  if (verified.length < 2) return { ok: false, error: 'This is your only authenticator. Add another one before removing it.' }
  if (!verified.some((f) => f.id === factorId)) return { ok: false, error: 'That authenticator is already gone. Reload the page.' }
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) return { ok: false, error: 'We couldn’t remove it. Try again in a minute.' }
  captureServerEvent(user.id, 'admin_mfa_factor_removed', { portal: p, remaining: verified.length - 1 })
  return { ok: true }
}
