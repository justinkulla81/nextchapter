'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// An outside link on the Buy a business page. Opens in a new tab and records which resource was opened,
// from which tab and stage, so we can see what buyers actually use.
export function BuyLink({
  href,
  kind,
  id,
  stage,
  className = 'text-sm font-medium text-brand underline underline-offset-4',
  children,
}: {
  href: string
  kind: string
  id: string
  stage: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => posthog.capture(kind.startsWith('start_') ? 'start_business_resource_clicked' : 'buy_business_resource_clicked', { kind, id, stage, href })}
    >
      {children}
    </a>
  )
}
