'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { decideCoachTopic } from '@/app/dashboard/my-coaching/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export interface CoachTopicRow {
  id: string
  topic: string
  label: string
  effect: string
  status: 'confirmed' | 'accepted' | 'dismissed'
}

// The topics a coach confirmed, each with Accept and Dismiss and a plain line on what accepting changes. Accepting
// takes effect at once: the learning plan reads accepted topics on its next load. Built to match
// src/app/dev-preview/_mockups/coach-candidate.tsx (the "Topics Maya heard you want help with" section).
export function CoachTopics({ coachFirstName, topics }: { coachFirstName: string; topics: CoachTopicRow[] }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const decide = (t: CoachTopicRow, decision: 'accepted' | 'dismissed') => {
    if (t.status === decision) return
    setError(null)
    setBusyId(t.id)
    start(async () => {
      const r = await decideCoachTopic(t.id, decision)
      setBusyId(null)
      if (!r.ok) {
        setError(r.error)
        return
      }
      posthog.capture(decision === 'accepted' ? 'coach_topic_accept_clicked' : 'coach_topic_dismiss_clicked', { topicId: t.id, topic: t.topic })
    })
  }

  return (
    <div className={cn('space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <ul className="space-y-3">
        {topics.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5">
            <div className="max-w-xl">
              <p className="text-base font-semibold text-ink">{t.label}</p>
              <p className="text-sm text-muted-foreground">If you accept: {t.effect}</p>
              <p className="text-sm text-muted-foreground">If you dismiss: we do not use it, and nothing about your plan changes.</p>
            </div>
            <div className="flex gap-2" role="group" aria-label={`${t.label}: accept or dismiss`}>
              <button type="button" aria-pressed={t.status === 'accepted'} disabled={pending && busyId === t.id} onClick={() => decide(t, 'accepted')} className={cn('inline-flex h-10 items-center rounded-lg border px-5 text-sm font-semibold', t.status === 'accepted' ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')}>
                {t.status === 'accepted' && <Check className="mr-1.5 size-4" aria-hidden />}
                {t.status === 'accepted' ? 'Accepted' : 'Accept'}
              </button>
              <button type="button" aria-pressed={t.status === 'dismissed'} disabled={pending && busyId === t.id} onClick={() => decide(t, 'dismissed')} className={cn('inline-flex h-10 items-center rounded-lg border px-5 text-sm font-semibold', t.status === 'dismissed' ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')}>
                {t.status === 'dismissed' ? 'Dismissed' : 'Dismiss'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="rounded-lg border border-orange/40 bg-orange/15 px-3 py-2 text-sm text-ink">{error}</p>}
      <p className="text-sm text-muted-foreground">Why: topics you accept shape the learning we suggest to you, and {coachFirstName} chose these after hearing what you want help with. You can change your mind here at any time.</p>
    </div>
  )
}
