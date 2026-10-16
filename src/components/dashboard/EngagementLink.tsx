'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { usePostHog } from '@/lib/posthog/client'

// A link on the "Get more from NextChapter" card that records which step the
// member clicked, and whether it came from an unlock step or a stalled-search move.
export function EngagementLink({
  href,
  stepKey,
  kind,
  level,
  className,
  children,
}: {
  href: string
  stepKey: string
  kind: 'unlock_step' | 'gate_move'
  level: string
  className?: string
  children?: ReactNode
}) {
  const posthog = usePostHog()
  return (
    <Link
      href={href}
      className={className}
      onClick={() => posthog?.capture('engagement_step_clicked', { stepKey, kind, level, destination: href })}
    >
      {children}
    </Link>
  )
}
