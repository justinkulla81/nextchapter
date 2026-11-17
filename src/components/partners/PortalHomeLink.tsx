'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'

// A link on a portal Home that records which Home item was acted on, so we can see which items people use. The href is not
// sent: some portal links carry an access token.
export function PortalHomeLink({ href, portal, item, className, children }: { href: string; portal: string; item: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => posthog.capture('portal_home_action_clicked', { portal, item })}>
      {children}
    </Link>
  )
}
