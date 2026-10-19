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

// A link that tells PostHog which action on which page was taken. "primary" is the one orange action a page has.
// "external" opens another site in a new tab.
export function ActionLink({ href, event, props, kind = 'secondary', external = false, className, children }: { href: string; event: string; props?: Record<string, unknown>; kind?: keyof typeof STYLES; external?: boolean; className?: string; children: ReactNode }) {
  const cls = cn(STYLES[kind], className)
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture(event, props)} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={() => posthog.capture(event, props)} className={cls}>
      {children}
    </Link>
  )
}
