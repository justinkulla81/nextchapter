'use client'

import Link from 'next/link'
import { usePostHog } from '@/lib/posthog/client'
import type { ReactNode } from 'react'
import { absoluteWebUrl } from '@/lib/http/external-url'

/**
 * A link that fires a PostHog event on click. External links (LinkedIn)
 * open in a new tab.
 */
export function TrackedLink({
  href, event, properties, className, children, ariaLabel, rel,
}: {
  href: string
  event: string
  properties?: Record<string, unknown>
  className?: string
  children: ReactNode
  ariaLabel?: string
  /** Extra rel tokens for an external link (e.g. 'nofollow'). */
  rel?: string
}) {
  const posthog = usePostHog()
  const onClick = () => posthog?.capture(event, properties)
  // A scheme-less outside address ("example.org/page") would otherwise be a relative link and 404.
  href = absoluteWebUrl(href) ?? href
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel={rel ? `noopener noreferrer ${rel}` : 'noopener noreferrer'} onClick={onClick} className={className} aria-label={ariaLabel}>
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
