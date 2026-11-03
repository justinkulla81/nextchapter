'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { getSkillWatched, setSkillWatched } from '@/app/skills/watch-actions'

/** Watch / Watching toggle for one skill. Signed-out visitors get a join link instead of an error. */
export function WatchSkillButton({ slug, name, source }: { slug: string; name: string; source: string }) {
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState<{ text: string; signedOut: boolean } | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    let live = true
    getSkillWatched(slug).then((w) => live && setWatching(w))
    return () => {
      live = false
    }
  }, [slug])

  function toggle() {
    setError(null)
    start(async () => {
      const r = await setSkillWatched(slug, !watching, source)
      if (r.ok) setWatching(r.watching)
      else setError({ text: r.error, signedOut: !!r.signedOut })
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={watching}
        aria-label={`${watching ? 'Stop watching' : 'Watch'} ${name}`}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait ${
          watching ? 'border border-border bg-white text-navy hover:bg-muted/40' : 'bg-brand text-white hover:opacity-90'
        } ${pending ? 'cursor-wait' : ''}`}
      >
        {pending ? 'Saving…' : watching ? 'Watching' : 'Watch this skill'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error.text}{' '}
          {error.signedOut && (
            <Link href="/auth/login" className="underline underline-offset-4">
              Sign in
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
