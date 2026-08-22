'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { completeEqOverIqContributorSignupFromSession } from '@/app/eqoveriq/contributors/signup/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { setPendingSignupRoleCookie } from '@/lib/auth/pending-signup-role'

// Mirrors EmployerSignupForm's shape exactly (same signUp -> pending-role
// cookie -> email-confirm-required -> CallbackHandler-finishes-the-profile
// flow) — just an individual contributor's fields (no company name) and a
// different next= value.
export function ContributorSignupForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    setPendingSignupRoleCookie('eqoveriq-contributor')
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: 'eqoveriq-contributor' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=eqoveriq-contributor`,
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    // With email confirmation required at the project level, signUp doesn't
    // return an active session — the confirmation link lands on
    // CallbackHandler, which finishes the profile setup itself once the
    // session exists (see completeEqOverIqContributorSignupFromSession).
    if (!data.session) {
      setLoading(false)
      setSent(true)
      return
    }

    const result = await completeEqOverIqContributorSignupFromSession()
    if (result?.error) {
      setLoading(false)
      setError(result.error)
      return
    }
    router.replace('/eqoveriq/contributors/onboarding')
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        Check <span className="font-medium">{email}</span> for a link to confirm your account and start your
        application.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', loading && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
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
        {loading ? 'Creating account…' : 'Create your account'}
      </Button>
    </form>
  )
}
