'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SecureAccountForm } from './SecureAccountForm'

type Status = 'verifying' | 'secure-account' | 'redirecting' | 'error'

export function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('verifying')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const supabase = createClient()
      const code = searchParams.get('code')

      // Two delivery mechanisms depending on flow/project config: a `?code=`
      // query param (PKCE) or `#access_token=...&refresh_token=...` in the
      // URL hash fragment (implicit flow, used by this project for signup
      // confirmation, email-change confirmation, and magic links). The hash
      // is never sent to the server, so it can only be read and applied
      // client-side via setSession() — a plain server route can never see it.
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

    run()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  if (status === 'verifying') {
    return <p className="text-sm text-muted-foreground">Verifying your link…</p>
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
