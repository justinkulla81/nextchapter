'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

const STYLES = {
  primary: 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95',
  secondary: 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted',
  text: 'text-sm font-medium text-brand underline underline-offset-4',
} as const

// A link that looks like an action and reports the click. One orange primary per page; secondary and text
// links stay quiet. `event` is a snake_case past-tense name and `props` carries the IDs a query would need.
export function ActionLink({ href, variant = 'primary', event, props, external = false, children }: { href: string; variant?: keyof typeof STYLES; event?: string; props?: Record<string, unknown>; external?: boolean; children: ReactNode }) {
  const onClick = event ? () => posthog.capture(event, props) : undefined
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={STYLES[variant]}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={onClick} className={STYLES[variant]}>
      {children}
    </Link>
  )
}
