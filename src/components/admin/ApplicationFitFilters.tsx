'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string }

// Adjacent buttons for the two small choices on the application-fit page
// (window, member sort). Changing one updates the URL (the page is a server
// component) and records admin_application_fit_filter_changed.
export function ApplicationFitFilters({ days, sort }: { days: string; sort: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function choose(filter: 'days' | 'sort', value: string, current: string) {
    if (value === current) return
    posthog.capture('admin_application_fit_filter_changed', { filter, value, previous: current })
    const next = new URLSearchParams(params.toString())
    next.set(filter, value)
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  const group = (label: string, filter: 'days' | 'sort', current: string, options: Option[]) => (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="text-sm text-muted-foreground">{label}</span>
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={o.value === current ? 'default' : 'outline'}
          aria-pressed={o.value === current}
          onClick={() => choose(filter, o.value, current)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-4', pending && 'cursor-wait opacity-70')} aria-busy={pending}>
      {group('Window', 'days', days, [
        { value: '30', label: 'Last 30 days' },
        { value: '90', label: 'Last 90 days' },
      ])}
      {group('Sort members by', 'sort', sort, [
        { value: 'reaching', label: 'Most reaching' },
        { value: 'underselling', label: 'Most underselling' },
      ])}
    </div>
  )
}
