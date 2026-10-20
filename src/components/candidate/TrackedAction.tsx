'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const LOOK = {
  primary: 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95',
  secondary: 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted',
  text: 'text-sm font-medium text-brand underline underline-offset-4',
} as const

// One link look for every redesigned page, recording a PostHog event when it is used.
// "primary" is the one action color and appears once per page.
export function TrackedAction({
  href,
  event,
  properties,
  variant = 'secondary',
  external,
  className,
  children,
}: {
  href: string
  event: string
  properties?: Record<string, unknown>
  variant?: keyof typeof LOOK
  external?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(LOOK[variant], className)}
      onClick={() => posthog.capture(event, properties)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </Link>
  )
}
