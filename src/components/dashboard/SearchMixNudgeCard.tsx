'use client'

import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'
import posthog from 'posthog-js'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SearchMixNudge } from '@/lib/outcomes/search-mix'

// Advisory only. Never blocks or caps applications, and is dismissible for the
// week. Copy is written to encourage introductions, not to criticize.
export function SearchMixNudgeCard({ nudge, weekKey }: { nudge: SearchMixNudge; weekKey: string }) {
  const storageKey = `search-mix-nudge-dismissed:${weekKey}`
  // Read the dismissal from localStorage without setState-in-effect: the server
  // snapshot is "not dismissed", the client snapshot reads storage.
  const dismissed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('search-mix-nudge-change', onChange)
      return () => window.removeEventListener('search-mix-nudge-change', onChange)
    },
    () => {
      try {
        return localStorage.getItem(storageKey) === '1'
      } catch {
        return false
      }
    },
    () => false,
  )

  const visible = nudge.level !== 'none' && !dismissed

  useEffect(() => {
    if (visible) posthog.capture('search_mix_nudge_shown', { level: nudge.level, warmShare: nudge.warmShare, convertSuggestion: nudge.convertSuggestion })
  }, [visible, nudge.level, nudge.warmShare, nudge.convertSuggestion])

  if (!visible) return null

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="text-base font-semibold text-foreground">{nudge.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{nudge.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/network/contacts"
            onClick={() => posthog.capture('search_mix_nudge_clicked', { action: 'open_contacts', convertSuggestion: nudge.convertSuggestion })}
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90"
          >
            Find introductions for {nudge.convertSuggestion} {nudge.convertSuggestion === 1 ? 'role' : 'roles'}
          </Link>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              try {
                localStorage.setItem(storageKey, '1')
              } catch {}
              posthog.capture('search_mix_nudge_dismissed', { level: nudge.level })
              window.dispatchEvent(new Event('search-mix-nudge-change'))
            }}
          >
            Not this week
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
