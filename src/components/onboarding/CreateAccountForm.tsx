'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateAccountForm({ defaultEmail }: { defaultEmail: string | null }) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resent, setResent] = useState(false)

  async function sendConfirmation() {
    const supabase = createClient()
    // Converts the candidate's anonymous session into a permanent one —
    // same userId, same profile, no password. Sends a confirmation link to
    // this address; clicking it finishes registration.
    return supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=secure-account` }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await sendConfirmation()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSent(true)
  }

  async function handleResend() {
    setResent(false)
    await sendConfirmation()
    setResent(true)
  }

  if (sent) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Check <span className="font-medium">{email}</span> for a link to finish creating your
          account and unlock your full Hireability Report. Confirmation emails can occasionally
          take a while to arrive — if you don&apos;t see it after a few minutes, check spam or
          resend it below.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resent}
          className="text-sm text-primary underline underline-offset-4 disabled:opacity-50"
        >
          {resent ? 'Confirmation email sent!' : 'Resend confirmation email'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending…' : 'Finish creating my account'}
      </Button>
    </form>
  )
}
