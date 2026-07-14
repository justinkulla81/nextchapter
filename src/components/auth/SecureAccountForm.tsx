'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markPasswordSet } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Shown right after the anonymous-to-registered email confirmation link is
// clicked (see CreateAccountForm) — that flow only ever confirms an email
// address, never a password, so without this step the account would have no
// durable way to log back in. Offers either path: set a password directly,
// or link Google to the already-authenticated session.
export function SecureAccountForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePasswordSubmit(e: FormEvent) {
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

    await markPasswordSet()
    router.push('/onboarding')
    router.refresh()
  }

  async function handleGoogleLink() {
    setGoogleLoading(true)
    setError(null)

    const supabase = createClient()
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
    <div className="w-full max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Your email is confirmed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One more thing — set a password or connect Google so you can always get back into your
          account.
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
