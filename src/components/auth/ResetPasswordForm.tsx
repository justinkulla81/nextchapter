'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenHash = searchParams.get('token_hash')
  const [status, setStatus] = useState<'waiting' | 'confirm' | 'ready' | 'error'>(
    tokenHash ? 'confirm' : 'waiting'
  )

  // `token_hash` (+ `type=recovery`) is a link to our own domain — the token
  // is only consumed when the user clicks "Continue" below, not the instant
  // the page loads. This matters because email clients and corporate email
  // security scanners automatically prefetch links in incoming mail; if the
  // link auto-consumed a single-use token on page load, that prefetch alone
  // would burn it before the user ever clicked, and every reset link would
  // read as "invalid or expired" on the user's actual first click. A `code`
  // query param (PKCE) or `#access_token=...` hash fragment (implicit flow)
  // both come from Supabase's own hosted /auth/v1/verify redirect, which
  // already consumed the token before reaching this page — those are handled
  // automatically since there's no separate confirmation step to gate.
  async function confirmRecovery() {
    if (!tokenHash) return
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    setStatus(error ? 'error' : 'ready')
  }

  useEffect(() => {
    if (status !== 'waiting') return

    async function run() {
      const supabase = createClient()
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
  }, [status, searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (status === 'waiting') {
    return <p className="text-sm text-muted-foreground">Verifying your link…</p>
  }

  if (status === 'confirm') {
    return (
      <Button className="w-full" onClick={confirmRecovery}>
        Continue
      </Button>
    )
  }

  if (status === 'error') {
    return (
      <p className="text-sm text-destructive">
        This reset link is invalid or has expired. Please request a new one from the login page.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
