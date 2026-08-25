'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function AcceptSeatForm({ seatToken, invitedEmail }: { seatToken: string; invitedEmail: string }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [existingAccount, setExistingAccount] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient('talent')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invitedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=employer-seat&seatToken=${seatToken}`,
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    // Supabase's signUp() returns a fake-success shape (no error, no
    // session) when invitedEmail already has a confirmed account elsewhere
    // on the platform, rather than erroring — the one real signal is an
    // empty `identities` array. Without this check we'd tell someone to
    // check an email Supabase never actually sends.
    if (data.user && data.user.identities?.length === 0) {
      setLoading(false)
      setExistingAccount(true)
      return
    }

    // Email confirmation is required at the project level, so signUp
    // doesn't return an active session — the confirmation link lands on
    // CallbackHandler, which finishes accepting the seat itself (see
    // finishAcceptingEmployerSeat) once the session exists.
    if (!data.session) {
      setLoading(false)
      setSent(true)
      return
    }
  }

  if (existingAccount) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          {invitedEmail} already has an account — log in with it and this invite will carry over.
          If it doesn&apos;t, reach out to whoever invited you.
        </p>
        <Link
          href={`/talent/login?email=${encodeURIComponent(invitedEmail)}`}
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Log in
        </Link>
      </div>
    )
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        Check <span className="font-medium">{invitedEmail}</span> for a link to confirm your account and
        join the team.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', loading && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={invitedEmail} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Choose a password</Label>
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
        {loading ? 'Creating account…' : 'Create account & join team'}
      </Button>
    </form>
  )
}
