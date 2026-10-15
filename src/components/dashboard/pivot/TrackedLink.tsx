'use client'

import { posthog } from '@/lib/posthog/client'

// An outbound link that records the click, with the properties a query on
// "which suggested training do people actually open" would need.
export function TrackedLink({
  href,
  event,
  properties,
  children,
}: {
  href: string
  event: string
  properties: Record<string, unknown>
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
      onClick={() => posthog.capture(event, { ...properties, href })}
    >
      {children}
    </a>
  )
}
