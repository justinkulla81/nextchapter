'use client'

import { useState, useTransition } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { DEMO_PERSONAS } from '@/lib/higher-ed/workspaces'
import { resetDemoData, setDemoPersona } from '@/app/i/[slug]/(portal)/actions'

// "Demo mode" banner (spec §4). Everyone on a demo tenant sees the banner;
// only an nc_admin gets the Preview-as and Reset controls.
export function DemoBar({ slug, isNcAdmin, persona }: { slug: string; isNcAdmin: boolean; persona: string | null }) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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
        <span className="text-amber-900">Fictional people and data. Nothing here emails anyone.</span>

        {isNcAdmin && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
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
                {DEMO_PERSONAS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <SubmitButton size="sm" variant="outline" pendingLabel="Switching…" savedLabel="Switched">
                Switch view
              </SubmitButton>
            </form>

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
