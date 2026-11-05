'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { captureStartEmail } from '@/app/onboarding/start-gate-actions'
import { Dialog, DialogPopup } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SpinnerCursor } from '@/components/ui/spinner-cursor'
import { posthog } from '@/lib/posthog/client'
import { START_COPY, START_EVENT, START_PAYOFF, startDestination, type StartGateDetail } from '@/lib/onboarding/start-gate'

// One email box for the whole public site, mounted once in the root layout. A call to action (StartLink) opens it in place
// instead of loading the first question; the box says what the email buys, takes it, then goes on to the registration path.
// Without script the link is an ordinary link to the first question, so nothing depends on this loading.
export function StartGateHost() {
  const [detail, setDetail] = useState<StartGateDetail | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<StartGateDetail>).detail
      if (d) setDetail(d)
    }
    window.addEventListener(START_EVENT, on)
    ;(window as unknown as { __ncStartGate?: boolean }).__ncStartGate = true
    return () => {
      window.removeEventListener(START_EVENT, on)
      ;(window as unknown as { __ncStartGate?: boolean }).__ncStartGate = false
    }
  }, [])
  return <StartDialog detail={detail} onClose={() => setDetail(null)} />
}

function StartDialog({ detail, onClose }: { detail: StartGateDetail | null; onClose: () => void }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(captureStartEmail, undefined)
  const [email, setEmail] = useState('')
  const opened = useRef<string | null>(null)

  useEffect(() => {
    if (detail && opened.current !== detail.source + detail.href) {
      opened.current = detail.source + detail.href
      posthog.capture('start_gate_opened', { source: detail.source, situation: detail.situation ?? null })
    }
    if (!detail) opened.current = null
  }, [detail])

  useEffect(() => {
    if (state?.go && detail) {
      posthog.capture('start_gate_submitted', { source: detail.source, situation: detail.situation ?? null })
      router.push(state.go)
    }
    // Only when the server says where to go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.go])

  return (
    <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { if (detail) posthog.capture('start_gate_dismissed', { source: detail.source }); onClose() } }}>
      <DialogPopup aria-labelledby="start-gate-title" className="w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-white p-6 text-foreground shadow-xl sm:p-7">
        <form action={action} className={`space-y-5 ${pending || state?.go ? 'cursor-progress [&_*]:cursor-progress' : ''}`}>
          <SpinnerCursor active={pending || !!state?.go} />
          <input type="hidden" name="source" value={detail?.source ?? ''} />
          <input type="hidden" name="href" value={detail?.href ?? ''} />
          <div className="hidden" aria-hidden>
            <label htmlFor="start-gate-website">Website</label>
            <input id="start-gate-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">{START_COPY.eyebrow}</p>
            <h2 id="start-gate-title" className="font-display text-2xl leading-tight font-semibold tracking-tight text-balance text-ink">
              {START_COPY.headline}
            </h2>
            <p className="text-sm text-ink">
              {START_COPY.intro}
            </p>
            <ul className="space-y-1.5 text-sm text-ink">
              {START_PAYOFF.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 font-bold text-ink">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-gate-email" className="font-semibold text-ink">{START_COPY.emailLabel}</Label>
            <Input id="start-gate-email" name="email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <p className="text-sm text-muted-foreground">{START_COPY.emailHelp}</p>
          </div>
          {state?.error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}{' '}
              {state.existingAccount && <Link href="/auth/login" className="underline underline-offset-4">Log in</Link>}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={pending || !!state?.go}
              className="inline-flex h-12 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
            >
              {pending || state?.go ? 'One moment…' : START_COPY.action}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!detail) return
                posthog.capture('start_gate_skipped', { source: detail.source, situation: detail.situation ?? null })
                router.push(startDestination(detail.href, detail.source))
                onClose()
              }}
              className="text-sm text-muted-foreground underline underline-offset-4">
              {START_COPY.skip}
            </button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  )
}

export { startDestination }
