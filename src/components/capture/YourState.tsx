'use client'

import Link from 'next/link'
import { useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { rememberState, useVisitorState } from '@/lib/capture/visitor-state'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

/**
 * A one-line "near you" strip on an industry or job-title page: the visitor's state (the one they chose before, else where they appear
 * to be) with a link to that state's page and, where the page knows it, this topic's open-job count there. It renders nothing until a
 * state is known, so the page is the same for everyone without it.
 */
export function YourState({ label, counts, current }: { label: string; counts?: Record<string, number>; /** The state this page is already about: the strip hides when the visitor is in it. */ current?: string }) {
  const visitor = useVisitorState()
  const [picked, setPicked] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const code = picked ?? visitor.state
  if (!code || (current && code === current && !editing)) return null
  const jobs = counts?.[code]
  return (
    <div role="status" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-tint-mint px-5 py-3 text-sm text-navy">
      <span>
        {visitor.detected && !picked ? 'You look to be in ' : 'Your state: '}
        <strong>{stateName(code)}</strong>.{' '}
        {jobs ? <>{jobs.toLocaleString('en-US')} open {label.toLowerCase()} {jobs === 1 ? 'job' : 'jobs'} there. </> : null}
        <Link href={`/places/${stateSlug(code)}`} onClick={() => posthog.capture('your_state_clicked', { state: code, topic: label })} className="font-semibold underline underline-offset-2">
          See the {stateName(code)} job market
        </Link>
      </span>
      {editing ? (
        <select
          aria-label="Choose your state"
          value={code}
          onChange={(e) => { setPicked(e.target.value); rememberState(e.target.value); setEditing(false) }}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
        >
          {ALL_STATE_CODES.map((c) => <option key={c} value={c}>{stateName(c)}</option>)}
        </select>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-navy/70 underline underline-offset-2">Not there? Change</button>
      )}
    </div>
  )
}
