'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { saveHomeCity } from '@/app/dashboard/find-my-job/city-actions'

/**
 * "Add your city": without one, the board can't count local jobs (relevance.ts geography) and
 * shows only remote jobs and the places they'd move to. One click opens the two fields.
 */
export function AddCityPrompt({ surface, states, fallback }: { surface: string; states: string[]; fallback: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const r = await saveHomeCity(city, state).catch(() => ({ ok: false, error: 'Could not save. Try again in a moment.' }))
      if (!r.ok) {
        setError(r.error ?? 'Could not save. Try again in a moment.')
        return
      }
      posthog.capture('home_city_added', { surface, state })
      setDone(true)
      router.refresh()
    })
  }

  if (done) return <p className="text-sm text-success" role="status">Saved — local jobs near {city} now count.</p>
  return (
    <div className={cn('rounded-md border border-border bg-muted/40 px-3 py-2 text-sm', pending && 'cursor-wait')}>
      {!open ? (
        <p>
          <span className="text-foreground">We don&apos;t know your city, so we&apos;re only counting {fallback}.</span>{' '}
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              posthog.capture('home_city_prompt_opened', { surface })
            }}
            className="text-primary underline underline-offset-4"
          >
            Add your city
          </button>{' '}
          to see jobs you could commute to.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-muted-foreground">
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 block rounded-md border border-border bg-background px-2 py-1 text-foreground" />
          </label>
          <label className="text-muted-foreground">
            State
            <select value={state} onChange={(e) => setState(e.target.value)} className="mt-1 block rounded-md border border-border bg-background px-2 py-1 text-foreground">
              <option value="">Pick…</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" onClick={save} disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : 'Save my city'}
          </Button>
          {error && (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
