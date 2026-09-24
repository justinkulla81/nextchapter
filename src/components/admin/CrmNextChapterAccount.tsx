'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmIdentityMatch, rejectIdentityMatch } from '@/app/support/admin/(portal)/identity-matches/actions'

export interface NextChapterAccountInfo {
  account: { href: string; since: string } | null
  invitedAt: string | null
  possibleSignups: { matchId: string; name: string; email: string | null; signedUp: string; sameEmail: boolean }[]
}

/**
 * Whether this CRM person has a NextChapter candidate account — a checked
 * box when they do — and, for someone invited from the CRM, any sign-up
 * that looks like them, confirmable right here instead of only on the
 * Identity Matches page.
 */
export function CrmNextChapterAccount({ info, onChanged, membership }: { info: NextChapterAccountInfo; onChanged?: () => void; membership?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function act(fn: () => Promise<void>) {
    setError(null)
    start(async () => {
      try { await fn(); if (onChanged) onChanged(); else router.refresh() } catch { setError('That didn’t save. Try again, or use Identity Matches.') }
    })
  }

  return (
    <div className={pending ? 'cursor-wait' : undefined}>
      <p className="flex items-center gap-2">
        <input type="checkbox" checked={!!info.account} readOnly aria-label="Has a NextChapter candidate account" className="h-4 w-4 accent-primary" />
        {info.account ? (
          <span>
            NextChapter candidate account ·{' '}
            <Link href={info.account.href} className="text-primary underline underline-offset-4">view</Link>
            <span className="text-muted-foreground"> · signed up {info.account.since}{membership ? ` · ${membership}` : ''}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            No NextChapter account{info.invitedAt ? ` · invited ${info.invitedAt}` : ''}
          </span>
        )}
      </p>

      {info.possibleSignups.map((m) => (
        <div key={m.matchId} className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p>
            <span className="font-medium">Possible sign-up:</span> {m.name}
            {m.email ? ` · ${m.email}` : ''} · {m.signedUp}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {m.sameEmail ? 'Same email as this record.' : 'Similar name — check it’s the same person.'}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => confirmIdentityMatch(m.matchId))}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:cursor-wait"
            >
              {pending ? 'Linking…' : 'Link accounts'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => rejectIdentityMatch(m.matchId))}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:cursor-wait"
            >
              Not them
            </button>
          </div>
        </div>
      ))}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
