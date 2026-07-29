'use client'

import type { ReactNode } from 'react'
import { logPartnerClickThrough } from '@/lib/analytics/partner-click-actions'

interface OutboundPartnerLinkProps {
  href: string
  partnerName: string
  section: string
  className?: string
  children: ReactNode
}

// Prompt 70 — wraps any outbound link to a partner platform (Interim Work
// marketplace listing, job board recommendation) with click tracking. The
// link still navigates normally (target="_blank" means the current tab
// never unmounts) — the tracking call is fire-and-forget, not something
// the click needs to wait on.
export function OutboundPartnerLink({ href, partnerName, section, className, children }: OutboundPartnerLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        void logPartnerClickThrough(partnerName, section)
      }}
    >
      {children}
    </a>
  )
}
