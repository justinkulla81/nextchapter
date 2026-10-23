import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signInVerifiedEmail } from '@/lib/auth/verified-email-session'

function fakes(opts: {
  createError?: { code?: string; message: string } | null
  confirmedAt?: string | null
  noToken?: boolean
  verifyError?: boolean
}) {
  const createUser = vi.fn().mockResolvedValue({ data: {}, error: opts.createError ?? null })
  const generateLink = vi.fn().mockResolvedValue({
    data: opts.noToken
      ? { properties: {}, user: { id: 'u1', email_confirmed_at: opts.confirmedAt ?? null } }
      : { properties: { hashed_token: 'hash' }, user: { id: 'u1', email_confirmed_at: opts.confirmedAt ?? null } },
    error: null,
  })
  const verifyOtp = vi.fn().mockResolvedValue(
    opts.verifyError ? { data: {}, error: { message: 'bad' } } : { data: { user: { id: 'u1' } }, error: null },
  )
  const admin = { auth: { admin: { createUser, generateLink } } } as unknown as SupabaseClient
  const session = { auth: { verifyOtp } } as unknown as SupabaseClient
  return { admin, session, createUser, generateLink, verifyOtp }
}

describe('signInVerifiedEmail', () => {
  it('creates a confirmed user and signs them in', async () => {
    const f = fakes({})
    const result = await signInVerifiedEmail('sam@gmail.com', f)
    expect(result).toEqual({ ok: true, userId: 'u1', isNew: true })
    expect(f.createUser).toHaveBeenCalledWith({ email: 'sam@gmail.com', email_confirm: true })
    expect(f.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'hash' })
  })

  it('signs an existing, confirmed account in', async () => {
    const f = fakes({ createError: { code: 'email_exists', message: 'exists' }, confirmedAt: '2026-01-01T00:00:00Z' })
    expect(await signInVerifiedEmail('sam@gmail.com', f)).toEqual({ ok: true, userId: 'u1', isNew: false })
  })

  it('recognises an existing user from the error message when there is no code', async () => {
    const f = fakes({
      createError: { message: 'A user with this email address has already been registered' },
      confirmedAt: '2026-01-01T00:00:00Z',
    })
    expect(await signInVerifiedEmail('sam@gmail.com', f)).toMatchObject({ ok: true, isNew: false })
  })

  it('refuses an existing account whose email was never confirmed, and never redeems the link', async () => {
    const f = fakes({ createError: { code: 'email_exists', message: 'exists' }, confirmedAt: null })
    expect(await signInVerifiedEmail('sam@gmail.com', f)).toEqual({ ok: false, reason: 'unconfirmed_account' })
    expect(f.verifyOtp).not.toHaveBeenCalled()
  })

  it('fails closed on any other create error, a missing token, or a failed redeem', async () => {
    expect(await signInVerifiedEmail('a@gmail.com', fakes({ createError: { message: 'database down' } }))).toEqual({
      ok: false,
      reason: 'session_failed',
    })
    expect(await signInVerifiedEmail('a@gmail.com', fakes({ noToken: true }))).toEqual({ ok: false, reason: 'session_failed' })
    expect(await signInVerifiedEmail('a@gmail.com', fakes({ verifyError: true }))).toEqual({ ok: false, reason: 'session_failed' })
  })
})
