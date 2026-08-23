'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { completeHiringManagerSignup } from '@/app/hiring/signup/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { setPendingSignupRoleCookie } from '@/lib/auth/pending-signup-role'

// Mirrors RecruiterSignupForm — same shared supabase.auth.signUp() +
// email-confirmation-then-finish flow through CallbackHandler (Phase 1's
// mandated shared auth pattern). companyName is required here (unlike
// Recruiter's optional firmName) because it's load-bearing: it's the
// primitive src/lib/hiring/conflict-check.ts compares against a candidate's
// current employer to auto-detect the §A8 "same current employer" conflict.
export function HiringManagerSignupForm() {
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [existingAccount, setExistingAccount] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    setPendingSignupRoleCookie('hiring')
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: 'hiring_manager', company_name: companyName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=hiring`,
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    // Supabase's signUp() returns a fake-success shape (no error, no
    // session) for an email that already has a confirmed account, rather
    // than erroring — the one real signal is an empty `identities` array.
    // Without this check we'd tell someone to check an email Supabase never
    // actually sends.
    if (data.user && data.user.identities?.length === 0) {
      setLoading(false)
      setExistingAccount(true)
      return
    }

    // With email confirmation required at the project level, signUp doesn't
    // return an active session — the confirmation link lands on
    // CallbackHandler, which finishes setup itself (see
    // completeHiringManagerSignupFromSession) once the session exists.
    if (!data.session) {
      setLoading(false)
      setSent(true)
      return
    }

    const form = new FormData()
    form.set('fullName', fullName)
    form.set('companyName', companyName)

    const result = await completeHiringManagerSignup(undefined, form)
    if (result?.error) {
      setLoading(false)
      setError(result.error)
    }
    // On success, completeHiringManagerSignup redirects — leave loading true.
  }

  if (existingAccount) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          Looks like you already have an account with this email — log in instead of starting a
          new one.
        </p>
        <Link
          href={`/hiring/login?email=${encodeURIComponent(email)}`}
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
        Check <span className="font-medium">{email}</span> for a link to confirm your account and
        start reviewing submitted candidates.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4 rounded-lg border border-border p-4', loading && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="hiring-name">Full name</Label>
        <Input id="hiring-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hiring-email">Work email</Label>
        <Input id="hiring-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hiring-password">Password</Label>
        <Input
          id="hiring-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hiring-company">Company</Label>
        <Input
          id="hiring-company"
          required
          placeholder="Who are you hiring for?"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className={loading ? 'cursor-progress' : ''}>
        {loading ? 'Creating account…' : 'Create your account'}
      </Button>
    </form>
  )
}
