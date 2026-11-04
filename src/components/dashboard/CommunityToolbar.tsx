'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export interface CommunityFilterOption {
  /** '' for everything, `community:<id>` or `group:<dimension>:<value>`. */
  value: string
  label: string
}

/**
 * The row above the Industry and function feed (docs/candidate-redesign.md): one dropdown that narrows the feed to a community or
 * a group (there can be more than four, so a dropdown), and the one action, "Share something with your field", which opens the
 * post form in place so the feed is not pushed down by an always-open form.
 */
export function CommunityToolbar({ options, current, composer, hasFilter }: { options: CommunityFilterOption[]; current: string; composer: ReactNode; hasFilter: boolean }) {
  const router = useRouter()
  const [composing, setComposing] = useState(false)
  const [pending, setPending] = useState(false)

  function choose(value: string) {
    posthog.capture('community_filter_changed', { filter: value || 'everything' })
    setPending(true)
    const [kind, ...rest] = value.split(':')
    const href =
      kind === 'community' ? `/dashboard/community?community=${encodeURIComponent(rest.join(':'))}`
      : kind === 'group' ? `/dashboard/community?group=${encodeURIComponent(rest.join(':'))}`
      : '/dashboard/community'
    router.push(href)
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {options.length > 1 || hasFilter ? (
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            Show
            <select value={current} onChange={(e) => choose(e.target.value)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-ink">
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        {!composing && (
          <button
            type="button"
            onClick={() => {
              posthog.capture('community_composer_opened')
              setComposing(true)
            }}
            className="inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95"
          >
            Share something with your field
          </button>
        )}
      </div>
      {composing && (
        <section aria-label="Post to the community" className="space-y-3 rounded-2xl border border-border p-5">
          {composer}
          <button type="button" onClick={() => setComposing(false)} className="text-sm font-medium text-brand underline underline-offset-4">
            Close without posting
          </button>
        </section>
      )}
    </div>
  )
}
