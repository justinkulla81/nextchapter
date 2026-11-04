'use client'

import { useState, useTransition } from 'react'
import { setSkillWatched } from '@/app/skills/watch-actions'
import { cn } from '@/lib/utils'

const LINK = 'text-sm font-medium text-brand underline underline-offset-4'

/** Stop watching a skill in two steps, so a stray click never removes it. The safe choice (Keep watching) is the first control. */
export function UnwatchSkillButton({ slug, name }: { slug: string; name: string }) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!asking) {
    return <button type="button" onClick={() => setAsking(true)} className={LINK}>Stop watching</button>
  }
  return (
    <span className={cn('flex flex-wrap items-center gap-3', pending && 'cursor-wait')}>
      <button type="button" autoFocus disabled={pending} onClick={() => { setAsking(false); setError(null) }} className={LINK}>Keep watching</button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setSkillWatched(slug, false, 'following_page')
            if (!r.ok) setError(r.error)
          })
        }
        className="text-sm font-medium text-destructive underline underline-offset-4"
      >
        {pending ? 'Removing…' : `Stop watching ${name}`}
      </button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </span>
  )
}
