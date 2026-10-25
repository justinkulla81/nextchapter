'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { saveBoardAnswers } from '@/app/dashboard/network/advisory-boards/actions'
import { BOARD_EXPERIENCE_OPTIONS, type BoardExperience } from '@/lib/network/advisory-boards'

// Two answers, asked once: where they are with boards, and (optionally) the sectors they would serve. Adjacent
// buttons for the three choices; the answer saves at once and the page re-reads it.
export function BoardExperienceForm({ current, sectors }: { current: BoardExperience | null; sectors: string }) {
  const [value, setValue] = useState<BoardExperience | null>(current)
  const [text, setText] = useState(sectors)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const save = (next: BoardExperience, nextSectors: string) =>
    startTransition(async () => {
      setError(null)
      const r = await saveBoardAnswers(next, nextSectors)
      if (r.error) setError(r.error)
      else posthog.capture('board_experience_chosen', { experience: next, hasSectors: !!nextSectors.trim() })
    })

  return (
    <div className="space-y-3" aria-busy={pending} style={pending ? { cursor: 'wait' } : undefined}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Your board experience</legend>
        <div className="flex flex-wrap gap-2">
          {BOARD_EXPERIENCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              aria-pressed={value === o.value}
              onClick={() => {
                setValue(o.value)
                save(o.value, text)
              }}
              className={`inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium ${value === o.value ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor="board-sectors" className="text-sm font-semibold text-ink">Sectors you would serve (optional)</label>
        <input
          id="board-sectors"
          value={text}
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => value && text.trim() !== sectors.trim() && save(value, text)}
          placeholder="For example health, education, finance"
          className="block h-10 w-full max-w-md rounded-lg border border-border bg-white px-3 text-sm"
        />
        {!value && <p className="text-xs text-muted-foreground">Pick where you are first. Sectors save with it.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
