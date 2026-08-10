'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { GoogleButton } from './GoogleButton'

export function LoginForm({
  defaultNext = '/dashboard',
  forgotPasswordHref = '/auth/forgot-password',
  signupHref = '/onboarding/resume',
  showGoogle = true,
}: {
  defaultNext?: string
  forgotPasswordHref?: string
  signupHref?: string | null
  showGoogle?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResent(false)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setError(
        error.message === 'Email not confirmed'
          ? "Please confirm your email before logging in — we can resend the confirmation link."
          : error.message
      )
      return
    }

    // Fire-and-forget — a failed log shouldn't block getting the user into
    // the app, and there's no UI here that reflects login-history state.
    fetch('/api/auth/log-login', { method: 'POST' }).catch(() => {})

    // Leave loading true — we're navigating away, so there's no moment where
    // the button should look idle again before the new page appears.
    router.push(searchParams.get('next') ?? defaultNext)
  }

  async function handleResend() {
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      setError(error.message)
      return
    }
    setResent(true)
  }

  return (
    <div className={cn('space-y-4', loading && 'cursor-progress [&_*]:cursor-progress')}>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4"
              onClick={() => router.push(forgotPasswordHref)}
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            {error.includes('confirm your email') && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resent}
                className="text-sm text-primary underline underline-offset-4 disabled:opacity-50"
              >
                {resent ? 'Confirmation email sent!' : 'Resend confirmation email'}
              </button>
            )}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      {showGoogle && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <GoogleButton />
        </>
      )}
      {signupHref && (
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => router.push(signupHref)}
          >
            Sign up
          </button>
        </p>
      )}
    </div>
  )
}
