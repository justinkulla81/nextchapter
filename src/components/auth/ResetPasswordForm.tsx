'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { portalForPath } from '@/lib/supabase/portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenHash = searchParams.get('token_hash')
  // `next` is already a portal-prefixed path (e.g. /recruiters/dashboard —
  // see requestPasswordReset), so it doubles as the portal signal here: no
  // separate query param needed. Every non-candidate portal has its own
  // session cookie (src/lib/supabase/portal.ts) — resetting a password
  // under the wrong one would look successful here but strand the person
  // in a login loop on their portal's next real visit.
  const portal = portalForPath(searchParams.get('next') ?? '')
  const [status, setStatus] = useState<'waiting' | 'ready' | 'error'>(
    tokenHash ? 'ready' : 'waiting'
  )
  // A token_hash can only be verified once — track whether that already
  // happened locally so a retry after a later failure (e.g. weak password)
  // doesn't try to re-consume it and get a spurious "invalid token" error.
  const tokenConsumed = useRef(false)

  // `token_hash` (+ `type=recovery`) is a link to our own domain — the token
  // is only consumed on actual submit below, not the instant the page loads.
  // This matters because email clients and corporate email security
  // scanners automatically prefetch links in incoming mail; if the link
  // auto-consumed a single-use token on page load, that prefetch alone
  // would burn it before the user ever clicked, and every reset link would
  // read as "invalid or expired" on the user's actual first click. A `code`
  // query param (PKCE) or `#access_token=...` hash fragment (implicit flow)
  // both come from Supabase's own hosted /auth/v1/verify redirect, which
  // already consumed the token before reaching this page — those are handled
  // automatically since there's no separate confirmation step to gate.
  async function consumeToken(supabase: ReturnType<typeof createClient>) {
    if (tokenConsumed.current || !tokenHash) return null
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (!error) tokenConsumed.current = true
    return error
  }

  useEffect(() => {
    if (status !== 'waiting') return

    async function run() {
      const supabase = createClient(portal)
      const code = searchParams.get('code')

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

      setStatus(sessionError ? 'error' : 'ready')
    }

    run()
  }, [status, searchParams, portal])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient(portal)
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
    const next = searchParams.get('next')
    router.push(next && next.startsWith('/') ? next : '/dashboard')
  }

  if (status === 'waiting') {
    return <p className="text-sm text-muted-foreground">Verifying your link…</p>
  }

  if (status === 'error') {
    return (
      <p className="text-sm text-destructive">
        This reset link is invalid or has expired. Please request a new one from the login page.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', loading && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
