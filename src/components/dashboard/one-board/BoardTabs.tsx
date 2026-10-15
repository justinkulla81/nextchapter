'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export type BoardTab = 'board' | 'my_jobs'

/** Job board / My jobs — two views of the same page, the `tab` URL parameter. */
export function BoardTabs({ current, myJobsCount }: { current: BoardTab; myJobsCount: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function select(tab: BoardTab) {
    if (tab === current) return
    const next = new URLSearchParams(searchParams.toString())
    if (tab === 'board') next.delete('tab')
    else next.set('tab', tab)
    posthog.capture('job_board_tab_changed', { tab })
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  const tabs: { key: BoardTab; label: string }[] = [
    { key: 'board', label: 'Job board' },
    { key: 'my_jobs', label: myJobsCount > 0 ? `My jobs (${myJobsCount})` : 'My jobs' },
  ]
  return (
    <div role="tablist" aria-label="Job board views" className={cn('flex gap-1 border-b border-border', pending && 'cursor-wait')}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={current === t.key}
          aria-busy={pending}
          onClick={() => select(t.key)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            current === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            pending && 'cursor-wait'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
