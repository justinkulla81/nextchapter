'use client'

import { useState, useTransition } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { saveLikes } from '@/app/dashboard/work-profile/actions'
import { LESS_OPTIONS, MORE_OPTIONS, type Likes } from '@/lib/profile/work-profile'

// "What do you want less of, and more of?" Two sets of chips; pick any.
// Pivot paths and job matches use them: a move that leaves behind what you
// want less of, or gives you what you want more of, ranks higher.
export function LikesCard({ initial }: { initial: Likes }) {
  const [likes, setLikes] = useState<Likes>(initial)
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<{ error?: string; saved?: boolean } | null>(null)
  const toggle = <K extends string>(list: K[], k: K) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k])
  const save = (next: Likes) => {
    setLikes(next)
    start(async () => {
      const r = await saveLikes(next.less, next.more)
      setStatus(r.error ? { error: r.error } : { saved: true })
      if (!r.error) posthog.capture('job_likes_changed', { less: next.less, more: next.more })
    })
  }
  return (
    <section aria-labelledby="likes-h" className={cn('space-y-4 rounded-lg border border-border bg-card p-4', pending && 'cursor-wait')}>
      <div>
        <h2 id="likes-h" className="text-base font-semibold">
          What do you want to leave behind, and what do you want more of?
        </h2>
        <p className="text-sm text-muted-foreground">Pick any. Paths and jobs that get you away from these, and toward what you want, move up.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Less of</legend>
        <div className="flex flex-wrap gap-2">
          {LESS_OPTIONS.map((o) => (
            <Button key={o.key} type="button" size="sm" variant={likes.less.includes(o.key) ? 'default' : 'outline'} aria-pressed={likes.less.includes(o.key)} disabled={pending} onClick={() => save({ ...likes, less: toggle(likes.less, o.key) })}>
              {o.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">More of</legend>
        <div className="flex flex-wrap gap-2">
          {MORE_OPTIONS.map((o) => (
            <Button key={o.key} type="button" size="sm" variant={likes.more.includes(o.key) ? 'default' : 'outline'} aria-pressed={likes.more.includes(o.key)} disabled={pending} onClick={() => save({ ...likes, more: toggle(likes.more, o.key) })}>
              {o.label}
            </Button>
          ))}
        </div>
      </fieldset>
      {status?.error && (
        <p role="alert" className="text-sm text-destructive">
          {status.error}
        </p>
      )}
      {status?.saved && !pending && (
        <p role="status" className="text-xs text-muted-foreground">
          Saved. Refresh to see your paths re-ranked.
        </p>
      )}
    </section>
  )
}
