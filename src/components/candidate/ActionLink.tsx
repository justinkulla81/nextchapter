'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const STYLES = {
  primary: 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95',
  secondary: 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted',
  text: 'text-sm font-medium text-brand underline underline-offset-4',
} as const

// A link that looks like an action and tells PostHog which action on which page was taken. "primary" is the one orange
// action a page has; secondary (the default) and text stay quiet. `event` is a snake_case past-tense name and `props`
// carries the IDs a query would need. "external" opens another site in a new tab. `variant` is an alias of `kind`.
export function ActionLink({
  href,
  event,
  props,
  kind,
  variant,
  external = false,
  className,
  children,
}: {
  href: string
  event?: string
  props?: Record<string, unknown>
  kind?: keyof typeof STYLES
  variant?: keyof typeof STYLES
  external?: boolean
  className?: string
  children: ReactNode
}) {
  const cls = cn(STYLES[kind ?? variant ?? 'secondary'], className)
  const onClick = event ? () => posthog.capture(event, props) : undefined
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={onClick} className={cls}>
      {children}
    </Link>
  )
}
