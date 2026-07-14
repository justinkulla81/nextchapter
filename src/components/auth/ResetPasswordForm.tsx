'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Supabase recovery links land here with tokens in the URL hash fragment
  // (`#access_token=...&refresh_token=...`), not a `?code=` query param —
  // the @supabase/ssr browser client does not auto-detect/parse this, so it
  // has to be read and applied via setSession() explicitly.
  const [status, setStatus] = useState<'waiting' | 'ready' | 'error'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).get('access_token')
      ? 'waiting'
      : 'error'
  )

  useEffect(() => {
    if (status !== 'waiting') return
    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      setStatus(error ? 'error' : 'ready')
    })
  }, [status])

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
