'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

interface Employer {
  name: string
  slug: string
  recentNotices: number
  recentMonths: number
  latest: string | null
  announcedRecently: boolean
}

// Optional second question: has the visitor's employer filed layoff notices? Reads the same public WARN lookup the layoff
// risk check uses. It is a separate fact from the job's AI exposure and is shown that way.
export function AiJobCheckEmployer({ soc6 }: { soc6: string }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [employers, setEmployers] = useState<Employer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (query.length < 2) {
      setError('Type at least two letters of your employer’s name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/layoffs/employer-lookup?q=${encodeURIComponent(query)}`)
      const body = (await res.json()) as { employers?: Employer[]; error?: string }
      if (!res.ok) {
        setError(body.error ?? 'The lookup is not working right now. Try again in a minute.')
        return
      }
      setEmployers(body.employers ?? [])
      posthog.capture('ai_job_check_employer_checked', { soc6, query, found: body.employers?.length ?? 0 })
    } catch {
      setError('The lookup is not working right now. Try again in a minute.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={search} className={cn('flex max-w-xl flex-col gap-3 sm:flex-row', busy && 'cursor-wait')}>
        <label className="sr-only" htmlFor="ajc-employer">
          Your employer
        </label>
        <input
          id="ajc-employer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          autoComplete="off"
          placeholder="Your employer’s name"
          className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base"
        />
        <Button type="submit" disabled={busy} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          {busy ? 'Looking…' : 'Check my employer'}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {employers && employers.length === 0 && (
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          No layoff notices or announcements on our record for that name. That is not proof of safety: WARN notices cover employers with 100 or more employees and layoffs of 50 or more at a site.
        </p>
      )}
      {employers && employers.length > 0 && (
        <ul className="mt-4 max-w-xl space-y-3">
          {employers.map((emp) => (
            <li key={emp.slug} className="rounded-lg border border-border bg-white p-4 text-sm">
              <Link href={`/layoffs/company/${emp.slug}`} className="font-semibold text-brand underline underline-offset-4">
                {emp.name}
              </Link>
              <p className="mt-1 text-muted-foreground">
                {emp.recentNotices === 0
                  ? 'No WARN notices in the last 12 months.'
                  : `${emp.recentNotices} WARN notice${emp.recentNotices === 1 ? '' : 's'} in the last 12 months, across ${emp.recentMonths} month${emp.recentMonths === 1 ? '' : 's'}${emp.latest ? `, latest ${new Date(emp.latest).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}` : ''}.`}
                {emp.announcedRecently ? ' A layoff was announced or reported in the last 12 months.' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
