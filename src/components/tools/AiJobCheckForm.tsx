'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { findOccupations, type FindState } from '@/lib/ai-check/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// Job title in, closest occupations out. One clear match goes straight to its page; otherwise the visitor picks. Nothing is
// saved and no AI model is called.
export function AiJobCheckForm({ initialTitle = '', source = 'hub' }: { initialTitle?: string; source?: string }) {
  const router = useRouter()
  const [state, run, running] = useActionState<FindState, FormData>(findOccupations, { title: initialTitle })
  const started = useRef(false)
  const matches = state.matches

  useEffect(() => {
    posthog.capture('ai_job_check_viewed', { source })
  }, [source])

  useEffect(() => {
    if (!matches) return
    posthog.capture('ai_job_check_searched', { title: state.title, matchCount: matches.length, exactMatch: matches[0]?.exact ?? false, source })
    const only = matches.length === 1 || (matches[0]?.exact && !matches[1]?.exact)
    if (only) router.push(matches[0].path)
  }, [matches, state.title, source, router])

  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <form action={run} noValidate className={cn('space-y-4 rounded-xl border border-border bg-white p-6', running && 'cursor-wait')}>
        <label className="block text-sm font-medium text-navy" htmlFor="ajc-title">
          Your job title
          <input
            id="ajc-title"
            name="title"
            type="text"
            defaultValue={state.title ?? initialTitle}
            maxLength={80}
            autoComplete="off"
            placeholder="For example: marketing manager, accountant, software engineer"
            onChange={() => {
              if (!started.current) {
                started.current = true
                posthog.capture('ai_job_check_started', { source })
              }
            }}
            className="mt-1 h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          />
        </label>
        <Button type="submit" disabled={running} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          {running ? 'Checking…' : 'Check my job'}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>

      {matches && matches.length > 1 && (
        <section aria-labelledby="ajc-pick">
          <h2 id="ajc-pick" className="text-base font-semibold text-navy">
            Which one is closest to your job?
          </h2>
          <ul className="mt-3 space-y-2">
            {matches.map((m) => (
              <li key={m.path}>
                <Link
                  href={m.path}
                  onClick={() => posthog.capture('ai_job_check_match_chosen', { title: m.title, searched: state.title, source })}
                  className="block rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-navy hover:border-brand"
                >
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
