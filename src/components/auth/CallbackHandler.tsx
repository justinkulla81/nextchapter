'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { SecureAccountForm } from './SecureAccountForm'

type Status = 'verifying' | 'confirm' | 'secure-account' | 'redirecting' | 'error'

export function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') as EmailOtpType | null
  const [status, setStatus] = useState<Status>(tokenHash ? 'confirm' : 'verifying')

  function finish() {
    // Set explicitly by the anonymous-to-registered email confirmation
    // link (see CreateAccountForm) — that flow only ever confirms an
    // email address, it never sets a password, so the account otherwise
    // has no durable way to log back in afterward.
    if (searchParams.get('next') === 'secure-account') {
      setStatus('secure-account')
      return
    }
    setStatus('redirecting')
    router.replace('/onboarding')
    router.refresh()
  }

  // `token_hash` (+ `type`) is a link to our own domain — the token is only
  // consumed when the user clicks "Continue" below, not the instant the page
  // loads. This matters because email clients and corporate email security
  // scanners automatically prefetch links in incoming mail; if the link
  // auto-consumed a single-use token on page load, that prefetch alone would
  // burn it before the user ever clicked, and every confirmation link would
  // read as "invalid or expired" on the user's actual first click. See the
  // identical pattern in ResetPasswordForm, built for the same failure mode.
  async function confirmToken() {
    if (!tokenHash || !otpType) return
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    if (error) {
      console.error('CallbackHandler verifyOtp error:', error)
      setStatus('error')
      return
    }
    finish()
  }

  useEffect(() => {
    if (status !== 'verifying') return
    let cancelled = false

    async function run() {
      const supabase = createClient()
      const code = searchParams.get('code')

      // Two delivery mechanisms depending on flow/project config: a `?code=`
      // query param (PKCE) or `#access_token=...&refresh_token=...` in the
      // URL hash fragment (implicit flow). Both come from Supabase's own
      // hosted /auth/v1/verify redirect, which already consumed the token
      // before reaching this page — there's no separate confirmation step
      // to gate for those, unlike the token_hash case above.
      let sessionError: { message: string } | null = null
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        sessionError = error
      } else {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (!accessToken || !refreshToken) {
          sessionError = { message: 'missing tokens' }
        } else {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          sessionError = error
        }
      }

      if (cancelled) return

      if (sessionError) {
        console.error('CallbackHandler session error:', sessionError)
        setStatus('error')
        return
      }

      finish()
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, searchParams])

  if (status === 'verifying') {
    return <p className="text-sm text-muted-foreground">Verifying your link…</p>
  }

  if (status === 'confirm') {
    return (
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Confirm your email address</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One click and you&apos;re in — confirm to unlock your full Hireability Report and
            action plan.
          </p>
        </div>
        <Button className="w-full" onClick={confirmToken}>
          Continue
        </Button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <p className="text-sm text-destructive">
        This link is invalid or has expired. Please try again from where you left off.
      </p>
    )
  }

  if (status === 'secure-account') {
    return <SecureAccountForm />
  }

  return <p className="text-sm text-muted-foreground">Redirecting…</p>
}
