'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { SecureAccountForm } from './SecureAccountForm'
import { completeEmployerSignupFromSession } from '@/app/talent/signup/actions'
import { completeRecruiterSignupFromSession } from '@/app/recruiters/signup/actions'
import { completeCoachSignupFromSession } from '@/app/support/coach/signup/actions'
import { finishAcceptingEmployerSeat } from '@/app/talent/seats/accept/[token]/actions'
import { finishAcceptingCoachInvite } from '@/app/support/coach/(app)/invite-client/actions'
import { finishAcceptingRecruiterSource } from '@/app/recruiters/(app)/candidates/actions'
import { readPendingSignupRoleCookie, clearPendingSignupRoleCookie } from '@/lib/auth/pending-signup-role'

type Status = 'verifying' | 'confirm' | 'secure-account' | 'redirecting' | 'error'

export function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') as EmailOtpType | null
  const nextIsSecureAccount = searchParams.get('next') === 'secure-account'
  // Falls back to a same-browser cookie set at signUp() time when the
  // `?next=` query param didn't survive the round trip through the user's
  // inbox (some corporate email security scanners rewrite or truncate
  // outbound links) — without it, a recruiter/employer/coach whose `next`
  // param got dropped falls through to candidate onboarding instead of
  // their own portal. See pending-signup-role.ts.
  const pendingRole = typeof document !== 'undefined' ? readPendingSignupRoleCookie() : null
  const nextIsEmployer = searchParams.get('next') === 'employer' || pendingRole === 'employer'
  const nextIsRecruiter = searchParams.get('next') === 'recruiter' || pendingRole === 'recruiter'
  const nextIsCoach = searchParams.get('next') === 'coach' || pendingRole === 'coach'
  const nextIsEmployerSeat = searchParams.get('next') === 'employer-seat'
  const seatToken = searchParams.get('seatToken')
  const nextIsCoachInvite = searchParams.get('next') === 'coach-invite'
  const nextIsRecruiterSource = searchParams.get('next') === 'recruiter-source'
  const inviteToken = searchParams.get('inviteToken')
  // Every real token_hash link that lands here comes from CreateAccountForm,
  // which always sets next=secure-account — so skip the extra "Continue"
  // click and go straight to the password form, which consumes the token
  // itself on submit. See SecureAccountForm for why that's still safe
  // against email-scanner link prefetching (nothing fires until submit).
  const [status, setStatus] = useState<Status>(() => {
    if (!tokenHash) return 'verifying'
    return nextIsSecureAccount ? 'secure-account' : 'confirm'
  })

  async function finish() {
    // Fire-and-forget, same as LoginForm's password-sign-in path — a valid
    // session already exists by the time finish() runs, whether this was a
    // magic-link login or an OAuth/PKCE callback, so this is the equivalent
    // hook point for those flows.
    fetch('/api/auth/log-login', { method: 'POST' }).catch(() => {})

    // Single-use — clear it now so a later, unrelated /auth/callback visit
    // (e.g. a plain login magic link) never inherits a stale role.
    clearPendingSignupRoleCookie()

    // Set explicitly by the anonymous-to-registered email confirmation
    // link (see CreateAccountForm) — that flow only ever confirms an
    // email address, it never sets a password, so the account otherwise
    // has no durable way to log back in afterward.
    if (nextIsSecureAccount) {
      setStatus('secure-account')
      return
    }
    if (nextIsEmployer) {
      // A fresh employer signUp() never gets a session until this email is
      // confirmed, so TalentSignupForm couldn't finish creating the
      // EmployerProfile itself — do it now that a session exists, reading
      // the contact/company name back out of user_metadata.
      const result = await completeEmployerSignupFromSession()
      if (result.error) {
        console.error('completeEmployerSignupFromSession error:', result.error)
        setStatus('error')
        return
      }
      setStatus('redirecting')
      router.replace('/talent/roles/new')
      return
    }
    if (nextIsRecruiter) {
      const result = await completeRecruiterSignupFromSession()
      if (result.error) {
        console.error('completeRecruiterSignupFromSession error:', result.error)
        setStatus('error')
        return
      }
      setStatus('redirecting')
      router.replace('/recruiters/dashboard')
      return
    }
    if (nextIsCoach) {
      const result = await completeCoachSignupFromSession()
      if (result.error) {
        console.error('completeCoachSignupFromSession error:', result.error)
        setStatus('error')
        return
      }
      setStatus('redirecting')
      router.replace('/support/coach')
      return
    }
    if (nextIsEmployerSeat) {
      if (!seatToken) {
        setStatus('error')
        return
      }
      const result = await finishAcceptingEmployerSeat(seatToken)
      if (result.error) {
        console.error('finishAcceptingEmployerSeat error:', result.error)
        setStatus('error')
        return
      }
      setStatus('redirecting')
      router.replace('/talent')
      return
    }
    if (nextIsCoachInvite) {
      // Admin-generated magic link (createUser + email_confirm: true) —
      // this is the candidate's very first time authenticating, so unlike
      // the other next= branches they still need to set a real password
      // before going anywhere. coachId gets set inside
      // finishAcceptingCoachInvite itself; SecureAccountForm below just
      // needs a valid session, which already exists at this point.
      if (!inviteToken) {
        setStatus('error')
        return
      }
      const result = await finishAcceptingCoachInvite(inviteToken)
      if (result.error) {
        console.error('finishAcceptingCoachInvite error:', result.error)
        setStatus('error')
        return
      }
      setStatus('secure-account')
      return
    }
    if (nextIsRecruiterSource) {
      // Same shape as nextIsCoachInvite above — sourcingRecruiterId gets set
      // inside finishAcceptingRecruiterSource itself.
      if (!inviteToken) {
        setStatus('error')
        return
      }
      const result = await finishAcceptingRecruiterSource(inviteToken)
      if (result.error) {
        console.error('finishAcceptingRecruiterSource error:', result.error)
        setStatus('error')
        return
      }
      setStatus('secure-account')
      return
    }
    setStatus('redirecting')
    router.replace('/onboarding')
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
    await finish()
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

      await finish()
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
            One click and you&apos;re in — confirm to unlock your full Market Reality Report and
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
    return <SecureAccountForm tokenHash={tokenHash} otpType={otpType} />
  }

  return <p className="text-sm text-muted-foreground">Redirecting…</p>
}
