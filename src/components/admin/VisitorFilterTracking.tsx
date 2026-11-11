'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// Admin visitor-log filters, with a PostHog event for each use. `filter` is which control, `value` what was chosen.
type Context = { range: string; sort: string | null; bots: boolean; email: string | null; type: string | null; unique: boolean }

export function TrackedFilterLink({ filter, value, context, ...props }: { filter: 'email_crm' | 'traffic' | 'range' | 'sort' | 'unique'; value: string; context: Context } & ComponentProps<typeof Link>) {
  return <Link {...props} onClick={() => posthog.capture('visitor_log_filter_changed', { filter, value, ...context })} />
}

export function TrackedTypeForm({ context, children, ...props }: { context: Context; children: ReactNode } & Omit<ComponentProps<'form'>, 'onSubmit'>) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        const value = String(new FormData(e.currentTarget).get('type') ?? '') || 'all'
        posthog.capture('visitor_log_filter_changed', { filter: 'visitor_type', value, ...context })
      }}
    >
      {children}
    </form>
  )
}
