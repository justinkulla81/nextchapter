'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import type { ReactNode } from 'react'

/**
 * A link that fires a PostHog event on click. External links (LinkedIn)
 * open in a new tab.
 */
export function TrackedLink({
  href, event, properties, className, children, ariaLabel,
}: {
  href: string
  event: string
  properties?: Record<string, unknown>
  className?: string
  children: ReactNode
  ariaLabel?: string
}) {
  const posthog = usePostHog()
  const onClick = () => posthog?.capture(event, properties)
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}
