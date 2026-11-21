'use client'

import { useState, useTransition } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import posthog from 'posthog-js'
import { resetDemoData, setDemoAlum, setDemoPersona, setDemoStart, skipDemoAhead } from '@/app/i/[slug]/(portal)/actions'
import { DEMO_STARTS } from '@/lib/higher-ed/demo-start-shared'
import { DEMO_ALUMNI } from '@/lib/higher-ed/demo-alumni-shared'

// "Demo mode" banner (spec §4). Everyone on a demo tenant sees the banner;
// only an nc_admin gets the Preview-as and Reset controls.
export function DemoBar({
  slug,
  isNcAdmin,
  persona,
  guest = false,
  canReset = true,
  canSkip = true,
  personas,
  guestLink = null,
  alum = null,
  college = false,
  checkinHref = null,
  start = null,
}: {
  // The "Start with" choice (DEMO_STARTS).
  start?: string | null
  // The demo check-in walkthrough's address on this host.
  checkinHref?: string | null
  // The sample alum the Candidate view shows (DEMO_ALUMNI), and whether this demo is a college (alumni stories apply).
  alum?: string | null
  college?: boolean
  slug: string
  // A link that opens this demo read-only, no account needed (src/lib/higher-ed/demo-guest.ts). Null: not offered.
  guestLink?: string | null
  isNcAdmin: boolean
  persona: string | null
  // A prospect on a guest pass: read-only, can switch who they look as.
  guest?: boolean
  // Reset and skip-ahead need a college fixture; generated demos have none.
  canReset?: boolean
  // "Skip ahead 60 days" moves a college's quiet periods; workforce demos have none.
  canSkip?: boolean
  personas: { key: string; label: string; group?: 'all' | 'staff' | 'outside' }[]
}) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  function copyLink() {
    if (!guestLink) return
    navigator.clipboard
      .writeText(guestLink)
      .then(() => {
        setCopied('yes')
        posthog.capture('demo_guest_link_copied', { slug, guest })
      })
      .catch(() => setCopied('failed'))
  }
  const [pending, startTransition] = useTransition()

  function reset() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await resetDemoData(slug)
        setMessage(result.error ?? `Demo data reset: ${result.members} members reseeded.`)
      } catch {
        setMessage('The reset failed. Nothing was half-applied (it runs in one transaction). Try again.')
      } finally {
        setConfirming(false)
      }
    })
  }

  return (
    <div role="region" aria-label="Demo mode" className={cn('border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950', pending && 'cursor-wait')}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <FlaskConical className="size-4" aria-hidden="true" />
          Demo mode
        </span>
        <span className="text-amber-900">
          {guest ? 'Sample people and companies, real regional data. Read-only. Nothing here emails anyone.' : 'Fictional people and data. Nothing here emails anyone.'}
        </span>

        {(isNcAdmin || guest) && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {guestLink && (
              <span className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={copyLink} title="Opens this demo read-only, no account needed. Works for 90 days.">
                  {copied === 'yes' ? 'Link copied' : 'Copy guest link'}
                </Button>
                {copied === 'failed' && (
                  <input aria-label="Guest link" readOnly value={guestLink} onFocus={(e) => e.currentTarget.select()} className="h-8 w-64 rounded-md border border-amber-300 bg-white px-2 text-xs" />
                )}
              </span>
            )}
            <form action={setDemoPersona.bind(null, slug)} className="flex items-center gap-2">
              <label htmlFor="demo-persona" className="font-medium">
                Preview as
              </label>
              <select
                id="demo-persona"
                name="persona"
                defaultValue={persona ?? 'all'}
                className="h-8 rounded-md border border-amber-300 bg-white px-2 text-sm"
              >
                {personas.filter((p) => !p.group || p.group === 'all').map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                {(
                  [
                    ['staff', 'Staff roles'],
                    ['outside', 'The people and companies you serve'],
                  ] as const
                ).map(([group, label]) =>
                  personas.some((p) => p.group === group) ? (
                    <optgroup key={group} label={label}>
                      {personas.filter((p) => p.group === group).map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </select>
              <SubmitButton size="sm" variant="outline" pendingLabel="Switching…" savedLabel="Switched">
                Switch view
              </SubmitButton>
            </form>

            {college && (
              <form action={setDemoStart.bind(null, slug)} className="flex items-center gap-2">
                <label htmlFor="demo-start" className="font-medium">
                  Start with
                </label>
                <select id="demo-start" name="start" defaultValue={start ?? 'all'} className="h-8 rounded-md border border-amber-300 bg-white px-2 text-sm">
                  {DEMO_STARTS.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <SubmitButton size="sm" variant="outline" pendingLabel="Switching…" savedLabel="Switched">
                  Show
                </SubmitButton>
              </form>
            )}
            {college && (
              <form action={setDemoAlum.bind(null, slug)} className="flex items-center gap-2">
                <label htmlFor="demo-alum" className="font-medium">
                  Sample alum
                </label>
                <select id="demo-alum" name="alum" defaultValue={alum ?? 'featured'} className="h-8 rounded-md border border-amber-300 bg-white px-2 text-sm">
                  {DEMO_ALUMNI.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <SubmitButton size="sm" variant="outline" pendingLabel="Switching…" savedLabel="Switched">
                  Show this alum
                </SubmitButton>
              </form>
            )}
            {college && checkinHref && (
              <a href={`${checkinHref}?alum=${alum ?? 'featured'}`} onClick={() => posthog.capture('he_demo_checkin_opened', { slug, alum: alum ?? 'featured' })} className="font-medium underline underline-offset-2">
                Try the check-in
              </a>
            )}

            {isNcAdmin && canReset && (
            <>
            {canSkip && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              className={cn(pending && 'cursor-wait')}
              onClick={() =>
                startTransition(async () => {
                  const r = await skipDemoAhead(slug)
                  setMessage(r.error ?? r.message ?? null)
                })
              }
            >
              Skip ahead 60 days
            </Button>
            )}
            {confirming ? (
              <span className="flex items-center gap-2">
                <span>Delete and reseed all of this demo&apos;s data?</span>
                <Button size="sm" variant="destructive" onClick={reset} disabled={pending} className={cn(pending && 'cursor-wait')}>
                  {pending ? 'Resetting…' : 'Reset now'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending} autoFocus>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
                Reset demo data
              </Button>
            )}
            </>
            )}
          </div>
        )}
      </div>
      {message && (
        <p role="status" className="mx-auto mt-1 max-w-7xl text-amber-900">
          {message}
        </p>
      )}
    </div>
  )
}
