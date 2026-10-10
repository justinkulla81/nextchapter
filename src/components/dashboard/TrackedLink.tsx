'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import type { ReactNode } from 'react'

/** A Next.js Link that records a PostHog event when clicked. */
export function TrackedLink({
  href,
  event,
  properties,
  className,
  external,
  children,
}: {
  href: string
  event: string
  properties?: Record<string, unknown>
  className?: string
  /** Opens in a new tab (another site). */
  external?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => posthog.capture(event, properties)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </Link>
  )
}
