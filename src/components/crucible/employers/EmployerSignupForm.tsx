'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { completeCrucibleEmployerSignupFromSession } from '@/app/crucible/employers/signup/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { setPendingSignupRoleCookie } from '@/lib/auth/pending-signup-role'
import { useRouter } from 'next/navigation'

// Mirrors TalentSignupForm's shape exactly (same signUp -> pending-role
// cookie -> email-confirm-required -> CallbackHandler-finishes-the-profile
// flow) — just a different `next=` value and no No-Ghosting Commitment
// section, which is a /talent-specific concept.
export function EmployerSignupForm() {
  const router = useRouter()
  const [contactName, setContactName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    setPendingSignupRoleCookie('crucible-employer')
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: contactName, account_type: 'crucible-employer', company_name: companyName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=crucible-employer`,
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
    // session exists (see completeCrucibleEmployerSignupFromSession).
    if (!data.session) {
      setLoading(false)
      setSent(true)
      return
    }

    const result = await completeCrucibleEmployerSignupFromSession()
    if (result?.error) {
      setLoading(false)
      setError(result.error)
      return
    }
    router.replace('/crucible/employers/onboarding')
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        Check <span className="font-medium">{email}</span> for a link to confirm your account and
        get started.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', loading && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="contactName">Your name</Label>
        <Input id="contactName" required value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Company name</Label>
        <Input id="companyName" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
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
        {loading ? 'Creating account…' : 'Create your free account'}
      </Button>
    </form>
  )
}
