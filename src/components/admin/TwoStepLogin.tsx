'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { startTotpEnrollment, verifyTotp, removeTotpFactor, type MfaPortal } from '@/app/support/admin/mfa/actions'
import { cn } from '@/lib/utils'

export type TwoStepFactor = { id: string; name: string; added: string }

type Enrollment = { factorId: string; qrCode: string; secret: string }

const primary = 'inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70'
const quiet = 'inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:cursor-wait disabled:opacity-70'

/**
 * The whole two-step login screen. Three states, decided on the server:
 * no authenticator yet (set one up), one set up but this session hasn't used
 * it (enter a code), or already verified (manage authenticators, add a backup).
 */
export function TwoStepLogin({
  portal,
  email,
  verified,
  factors,
  required,
  next,
}: {
  portal: MfaPortal
  email: string
  verified: boolean
  factors: TwoStepFactor[]
  required: boolean
  next: string
}) {
  const router = useRouter()
  const posthog = usePostHog()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [factorId, setFactorId] = useState(factors[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const mode = enrollment ? 'enroll' : verified ? 'manage' : factors.length ? 'challenge' : 'setup'

  useEffect(() => {
    posthog.capture('admin_mfa_screen_shown', { portal, mode: verified ? 'manage' : factors.length ? 'challenge' : 'setup', required })
  }, [posthog, portal, verified, factors.length, required])

  const begin = () =>
    startTransition(async () => {
      setError(null)
      posthog.capture('admin_mfa_setup_clicked', { portal, backup: factors.length > 0 })
      const r = await startTotpEnrollment(portal)
      if (r.ok) {
        setEnrollment({ factorId: r.factorId, qrCode: r.qrCode, secret: r.secret })
        setCode('')
      } else setError(r.error)
    })

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault()
    const target = enrollment?.factorId ?? factorId
    startTransition(async () => {
      setError(null)
      const r = await verifyTotp(portal, target, code, !!enrollment)
      if (!r.ok) {
        setError(r.error)
        return
      }
      if (enrollment) {
        setEnrollment(null)
        setCode('')
        setDone('Two-step login is on. From now on you’ll enter a code from this app after your password.')
        router.refresh()
      } else {
        router.push(next)
      }
    })
  }

  const remove = (id: string) =>
    startTransition(async () => {
      setError(null)
      const r = await removeTotpFactor(portal, id)
      setConfirmRemove(null)
      if (r.ok) router.refresh()
      else setError(r.error)
    })

  const codeField = (
    <div className="space-y-1">
      <label htmlFor="totp-code" className="block text-sm font-medium">
        6-digit code
      </label>
      <input
        id="totp-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        required
        autoFocus
        className="block h-10 w-36 rounded-md border border-input bg-background px-3 text-base tracking-widest"
      />
    </div>
  )

  return (
    <div className={cn('space-y-5', pending && 'cursor-wait [&_*]:cursor-wait')}>
      {done && <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">{done}</p>}

      {mode === 'setup' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {required
              ? 'Admin access now needs a second step: a code from an authenticator app on your phone. Set one up to continue.'
              : 'Add a second step to your admin login: a code from an authenticator app on your phone (1Password, Google Authenticator, Authy or similar).'}
          </p>
          <button type="button" onClick={begin} disabled={pending} className={primary}>
            {pending ? 'Starting…' : 'Set up an authenticator app'}
          </button>
        </div>
      )}

      {mode === 'enroll' && enrollment && (
        <form onSubmit={submitCode} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this code, or type the key below by hand.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL from Supabase, not a remote image */}
          <img src={enrollment.qrCode} alt="QR code for your authenticator app" width={180} height={180} className="rounded-md border border-border bg-white p-2" />
          <p className="text-sm">
            Key: <code className="select-all break-all rounded bg-muted px-1.5 py-0.5 text-xs">{enrollment.secret}</code>
          </p>
          {codeField}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className={primary}>
              {pending ? 'Checking…' : 'Turn on two-step login'}
            </button>
            <button type="button" onClick={() => { setEnrollment(null); setError(null) }} disabled={pending} className={quiet}>
              Cancel set-up
            </button>
          </div>
        </form>
      )}

      {mode === 'challenge' && (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter the code your authenticator app shows for {email}.</p>
          {factors.length > 1 && factors.length <= 4 && (
            <div role="group" aria-label="Authenticator" className="flex flex-wrap gap-2">
              {factors.map((f) => (
                <button key={f.id} type="button" onClick={() => setFactorId(f.id)} aria-pressed={factorId === f.id} className={cn(quiet, factorId === f.id && 'border-primary bg-muted')}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          {factors.length > 4 && (
            <select aria-label="Authenticator" value={factorId} onChange={(e) => setFactorId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              {factors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {codeField}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={pending} className={primary}>
            {pending ? 'Checking…' : 'Verify and continue'}
          </button>
          <p className="text-xs text-muted-foreground">
            Lost your phone? Use a backup authenticator if you added one. Otherwise the account owner removes the old one in the Supabase dashboard (Authentication → Users → your account), and you set up a new one here.
          </p>
        </form>
      )}

      {mode === 'manage' && (
        <div className="space-y-4">
          <p className="text-sm">Two-step login is on for {email}.</p>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {f.name}
                  <span className="block text-xs text-muted-foreground">Added {f.added}</span>
                </span>
                {factors.length > 1 && confirmRemove !== f.id && (
                  <button type="button" onClick={() => setConfirmRemove(f.id)} disabled={pending} className="text-sm text-destructive underline underline-offset-4">
                    Remove
                  </button>
                )}
                {confirmRemove === f.id && (
                  <span className="flex items-center gap-3">
                    <button type="button" onClick={() => setConfirmRemove(null)} className="text-sm underline underline-offset-4">
                      Keep it
                    </button>
                    <button type="button" onClick={() => remove(f.id)} disabled={pending} className="text-sm font-medium text-destructive underline underline-offset-4">
                      {pending ? 'Removing…' : 'Remove this authenticator'}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {factors.length === 1 && (
            <p className="text-sm text-muted-foreground">
              Add a backup on a second device (or a password manager) so a lost phone doesn’t lock you out.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <a href={next} className={primary}>
              Continue
            </a>
            <button type="button" onClick={begin} disabled={pending} className={quiet}>
              {pending ? 'Starting…' : 'Add a backup authenticator'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
