'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkEmailAvailableForSignup } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { cn } from '@/lib/utils'

// The email is already known (resume-derived / confirmed earlier in
// onboarding) — this step is just finishing account creation, never asking
// the candidate to type or retype it. It still has to go out as a real
// Supabase email-confirmation send (mailer_autoconfirm=false), just without
// making the candidate do anything but click one button.
export function CreateAccountForm({ email }: { email: string | null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{ needsPassword: boolean } | null>(null)

  async function sendConfirmation() {
    const supabase = createClient()
    // Converts the candidate's anonymous session into a permanent one —
    // same userId, same profile, no password. Sends a confirmation link to
    // this address; clicking it finishes registration.
    return supabase.auth.updateUser(
      { email: email ?? '' },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=secure-account` }
    )
  }

  async function handleSend() {
    if (!email) return
    setLoading(true)
    setError(null)

    const availability = await checkEmailAvailableForSignup(email)
    if (availability.blocked) {
      setLoading(false)
      setBlocked({ needsPassword: availability.needsPassword })
      return
    }

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
    setResendError(null)
    const { error } = await sendConfirmation()
    if (error) {
      setResendError(error.message)
      return
    }
    setResent(true)
  }

  if (blocked) {
    return <ExistingAccountNotice needsPassword={blocked.needsPassword} email={email ?? ''} />
  }

  if (sent) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Check <span className="font-medium">{email}</span> for a link to set your password and
          see your full Hireability Report. Confirmation emails can occasionally take a while to
          arrive — if you don&apos;t see it after a few minutes, check spam or resend it below.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resent}
          className="text-sm text-primary underline underline-offset-4 disabled:opacity-50"
        >
          {resent ? 'Confirmation email sent!' : 'Resend confirmation email'}
        </button>
        {resendError && <p className="text-sm text-destructive">{resendError}</p>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', loading && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-foreground">
        We&apos;ll send a confirmation link to <span className="font-medium">{email}</span>.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" className="w-full" disabled={loading} onClick={handleSend}>
        {loading ? 'Sending…' : 'Send me the link →'}
      </Button>
      <p className="text-xs text-muted-foreground">
        We&apos;ll also send occasional NextChapter updates. Unsubscribe anytime.
      </p>
    </div>
  )
}
