'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { completeRecruiterSignup } from '@/app/recruiters/signup/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function RecruiterSignupForm() {
  const [fullName, setFullName] = useState('')
  const [firmName, setFirmName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: 'recruiter', firm_name: firmName, specialty },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=recruiter`,
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    // With email confirmation required at the project level, signUp doesn't
    // return an active session — the confirmation link lands on
    // CallbackHandler, which finishes the recruiter setup itself (see
    // completeRecruiterSignupFromSession) once the session exists.
    if (!data.session) {
      setLoading(false)
      setSent(true)
      return
    }

    const form = new FormData()
    form.set('fullName', fullName)
    form.set('firmName', firmName)
    form.set('specialty', specialty)

    const result = await completeRecruiterSignup(undefined, form)
    if (result?.error) {
      setLoading(false)
      setError(result.error)
    }
    // On success, completeRecruiterSignup redirects — leave loading true.
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        Check <span className="font-medium">{email}</span> for a link to confirm your account and
        start calibrating searches.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4 rounded-lg border border-border p-4', loading && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="recruiter-name">Full name</Label>
        <Input id="recruiter-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-email">Work email</Label>
        <Input
          id="recruiter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-password">Password</Label>
        <Input
          id="recruiter-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-firm">Firm name (optional)</Label>
        <Input id="recruiter-firm" value={firmName} onChange={(e) => setFirmName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recruiter-specialty">What do you recruit for? (optional)</Label>
        <Input
          id="recruiter-specialty"
          placeholder="e.g. VP Finance, Operations Director"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className={loading ? 'cursor-progress' : ''}>
        {loading ? 'Creating account…' : 'Create your account'}
      </Button>
    </form>
  )
}
