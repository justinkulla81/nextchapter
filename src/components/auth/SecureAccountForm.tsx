'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { markPasswordSet } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SecureAccountFormProps {
  // Present when reached via a token_hash link (see CreateAccountForm) —
  // the token is only consumed here, on actual submit, not on page load.
  // This matters because email clients and corporate security scanners
  // prefetch links in incoming mail; auto-consuming on load would burn the
  // single-use token before the user's real click. Same reasoning as
  // ResetPasswordForm's identical click-gate pattern, just folded into this
  // form's own submit instead of a separate "Continue" screen, since every
  // token_hash link that reaches this form always leads here next anyway.
  tokenHash?: string | null
  otpType?: EmailOtpType | null
}

// Shown right after the anonymous-to-registered email confirmation link is
// clicked (see CreateAccountForm) — that flow only ever confirms an email
// address, never a password, so without this step the account would have no
// durable way to log back in. Offers either path: set a password directly,
// or link Google to the already-authenticated session.
export function SecureAccountForm({ tokenHash, otpType }: SecureAccountFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A token_hash can only be verified once — track whether that already
  // happened locally so a retry after a later failure (e.g. weak password)
  // doesn't try to re-consume it and get a spurious "invalid token" error.
  const tokenConsumed = useRef(false)

  async function consumeToken(supabase: ReturnType<typeof createClient>) {
    if (tokenConsumed.current || !tokenHash || !otpType) return null
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    if (!error) tokenConsumed.current = true
    return error
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const verifyError = await consumeToken(supabase)
    if (verifyError) {
      setLoading(false)
      setError(verifyError.message)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    // Leave loading true — we're navigating away, so there's no moment where
    // the button should look idle again before the new page appears.
    await markPasswordSet()
    router.push('/onboarding')
  }

  async function handleGoogleLink() {
    setGoogleLoading(true)
    setError(null)

    const supabase = createClient()
    const verifyError = await consumeToken(supabase)
    if (verifyError) {
      setGoogleLoading(false)
      setError(verifyError.message)
      return
    }

    const redirectTo = new URL('/onboarding', window.location.origin)
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    })

    if (error) {
      setGoogleLoading(false)
      // Requires "Allow manual linking" enabled in Supabase Auth settings —
      // fall back gracefully to the password option if it's off.
      setError(
        /manual linking/i.test(error.message)
          ? "Google linking isn't turned on for this account yet — set a password below instead."
          : error.message
      )
    }
    // On success the browser is redirected to Google — nothing further to do here.
  }

  return (
    <div
      className={cn(
        'w-full max-w-md space-y-6',
        (loading || googleLoading) && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Confirm your email and set a password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One step unlocks your full Hireability Report and action plan, and gives you a way to
          always get back into your account.
        </p>
      </div>

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Create a password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Set password & continue'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleLink}
        disabled={googleLoading}
      >
        {googleLoading ? 'Redirecting…' : 'Connect Google instead'}
      </Button>
    </div>
  )
}
