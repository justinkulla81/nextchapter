'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkEmailAvailableForSignup } from '@/app/auth/actions'
import { setCandidateEmail } from '@/app/onboarding/create-account/actions'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { looksLikeCorporateDomain } from '@/lib/text/email-domain'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The email is normally already known (resume-derived / confirmed earlier in
// onboarding) — this step is just finishing account creation, so the
// confirmation email fires automatically on mount instead of waiting on a
// "Send me the link" click the candidate has no real reason to make. It
// still has to go out as a real Supabase email-confirmation send
// (mailer_autoconfirm=false); this just removes the unnecessary click in
// front of it.
//
// Resume extraction sometimes finds no email at all (no plain-text email on
// the resume, empty extracted text, or the model just misses it) — in that
// case `email` arrives null and there's no address to send anything to, so
// this falls back to asking the candidate for one directly instead of
// silently hanging.
export function CreateAccountForm({
  email: initialEmail,
  confidentialSearchMode = false,
}: {
  email: string | null
  confidentialSearchMode?: boolean
}) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [emailInput, setEmailInput] = useState('')
  const [emailInputError, setEmailInputError] = useState<string | null>(null)
  const [submittingManualEmail, setSubmittingManualEmail] = useState(false)
  const [needsEmailInput, setNeedsEmailInput] = useState(!initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<{ needsPassword: boolean } | null>(null)

  // §4.5: "Never send to a work address. If the registered address is a
  // corporate domain, warn and request a personal one." Resume-derived
  // emails skip straight to auto-sending (see the effect below) — this
  // interrupts that for a Confidential Search Mode candidate whose
  // resume-derived address looks corporate, same as the manual-entry path
  // already requires a deliberate submit either way. Derived from stable
  // props, so it's a plain const, never state — it can't change after mount.
  const corporateEmailWarning = confidentialSearchMode && !!initialEmail && looksLikeCorporateDomain(initialEmail)
  const [useAnywayConfirmed, setUseAnywayConfirmed] = useState(false)
  // Starts "already fired" when a warning is showing, so the auto-send
  // effect below skips it entirely — kept as a literal `if (firedRef.current
  // || !initialEmail) return` with no other condition, identical in shape
  // to how this effect worked before this feature, since referencing
  // corporateEmailWarning directly inside the effect body trips the
  // set-state-in-effect lint rule. handleUseEmailAnyway (below) fires the
  // send itself, from a real click, once the candidate confirms.
  const firedRef = useRef(corporateEmailWarning)

  async function sendConfirmation(targetEmail: string) {
    const supabase = createClient()
    // Converts the candidate's anonymous session into a permanent one —
    // same userId, same profile, no password. Sends a confirmation link to
    // this address; clicking it finishes registration.
    return supabase.auth.updateUser(
      { email: targetEmail },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=secure-account` }
    )
  }

  async function attemptSend(targetEmail: string) {
    // Everything below can throw (a rejected server action, a network
    // failure reaching Supabase) rather than resolving with an `{ error }`
    // — without this catch, an uncaught rejection here leaves the UI stuck
    // forever on the "Sending a confirmation link to…" state below, with no
    // error shown and no email ever actually sent.
    try {
      const availability = await checkEmailAvailableForSignup(targetEmail)
      if (availability.blocked) {
        setBlocked({ needsPassword: availability.needsPassword })
        return
      }

      const { error } = await sendConfirmation(targetEmail)

      if (error) {
        // The pre-check above only catches a duplicate that has a
        // CandidateProfile of its own to find — an auth.users row created
        // some other way (e.g. directly through Supabase, with no matching
        // profile) slips through it and only surfaces here, straight from
        // Supabase's own signup validation. Route it to the same recovery UI
        // rather than a bare, dead-end error string.
        if (/already.*registered/i.test(error.message)) {
          setBlocked({ needsPassword: false })
          return
        }
        setError(error.message)
        return
      }

      setSent(true)
    } catch {
      setError('Something went wrong sending your confirmation email. Try again below.')
    }
  }

  useEffect(() => {
    if (firedRef.current || !initialEmail) return
    firedRef.current = true
    attemptSend(initialEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail])

  // Fired from a real click, not an effect — corporateEmailWarning is
  // derived from stable props and never changes after mount, so the send
  // this unblocks only ever needs to happen once, right here.
  function handleUseEmailAnyway() {
    setUseAnywayConfirmed(true)
    if (firedRef.current || !initialEmail) return
    firedRef.current = true
    attemptSend(initialEmail)
  }

  async function handleManualEmailSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = emailInput.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailInputError('Enter a valid email address.')
      return
    }
    setEmailInputError(null)
    setSubmittingManualEmail(true)
    setEmail(trimmed)
    await setCandidateEmail(trimmed)
    setNeedsEmailInput(false)
    await attemptSend(trimmed)
    setSubmittingManualEmail(false)
  }

  async function handleResend() {
    setResent(false)
    setResendError(null)
    const { error } = await sendConfirmation(email)
    if (error) {
      setResendError(error.message)
      return
    }
    setResent(true)
  }

  if (blocked) {
    return <ExistingAccountNotice needsPassword={blocked.needsPassword} email={email} />
  }

  if (sent) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Check <span className="font-medium">{email}</span> for a link to set your password and
          see your full Market Reality Report. Confirmation emails can occasionally take a while to
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

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            attemptSend(email)
          }}
          className="text-sm text-primary underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    )
  }

  // No email came off the resume (extraction found nothing to parse) — ask
  // for one directly rather than leaving the candidate on an endless
  // "Sending a confirmation link to …" spinner with nowhere to go.
  if (needsEmailInput) {
    return (
      <form onSubmit={handleManualEmailSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find an email on your resume — enter the one you&apos;d like your
          report and account confirmation sent to.
        </p>
        <div className="space-y-1">
          <label htmlFor="create-account-email" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <Input
            id="create-account-email"
            type="email"
            autoComplete="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={!!emailInputError}
          />
          {emailInputError && <p className="text-sm text-destructive">{emailInputError}</p>}
        </div>
        <Button
          type="submit"
          disabled={submittingManualEmail}
          className={submittingManualEmail ? 'cursor-progress' : undefined}
        >
          {submittingManualEmail ? 'Sending…' : 'Send confirmation link'}
        </Button>
      </form>
    )
  }

  // §4.5 — interrupt the auto-send for a Confidential Search Mode candidate
  // whose resume-derived email looks like a work address, and let them
  // choose a personal one instead before anything gets sent there.
  if (corporateEmailWarning && !useAnywayConfirmed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          <span className="font-medium">{email}</span>
          {' '}looks like a work email. With Confidential Search Mode on, we&apos;d rather send
          your confirmation link and future emails somewhere your employer can&apos;t see.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setNeedsEmailInput(true)}>
            Use a personal email instead
          </Button>
          <Button type="button" variant="outline" onClick={handleUseEmailAnyway}>
            Use this email anyway
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="cursor-progress space-y-2 [&_*]:cursor-progress">
      <p className="text-sm text-muted-foreground">
        Sending a confirmation link to <span className="font-medium">{email}</span>…
      </p>
    </div>
  )
}
