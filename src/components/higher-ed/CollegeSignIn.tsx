'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClientLazy } from '@/lib/supabase/client-lazy'

// Sign in with the college's Google Workspace or Microsoft 365 account (or a
// personal one) and land on the college's welcome step, which joins anyone
// whose sign-in email is on the alumni roster.
export function CollegeSignIn({ slug, google, microsoft, college, workforce = false }: { slug: string; google: boolean; microsoft: boolean; college: string; workforce?: boolean }) {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const go = async (provider: 'google' | 'azure') => {
    setPending(provider)
    setError(null)
    const supabase = await createClientLazy()
    const redirectTo = new URL('/auth/callback', window.location.origin)
    redirectTo.searchParams.set('next', 'institution-join')
    redirectTo.searchParams.set('joinTo', `/i/${slug}/welcome`)
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo.toString(), ...(provider === 'azure' ? { scopes: 'email' } : {}) } })
    if (error) {
      setPending(null)
      setError('That sign-in didn’t start. Try again, or use the email option.')
    }
  }
  if (!google && !microsoft) return null
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <div className="flex flex-wrap gap-2">
        {google && (
          <Button variant="outline" disabled={!!pending} onClick={() => go('google')}>
            {pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </Button>
        )}
        {microsoft && (
          <Button variant="outline" disabled={!!pending} onClick={() => go('azure')}>
            {pending === 'azure' ? 'Redirecting…' : 'Continue with Microsoft'}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Use the account whose email {college} has on file for you, {workforce ? 'the one you signed up with.' : 'such as your college or work email.'}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
