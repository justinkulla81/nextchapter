'use client'

import type { ReactNode } from 'react'
import { logPartnerClickThrough } from '@/lib/analytics/partner-click-actions'
import { recordJobClick } from '@/app/dashboard/find-my-job/actions'

interface OutboundPartnerLinkProps {
  href: string
  partnerName: string
  section: string
  className?: string
  children: ReactNode
  /** The listing's id: also logs the click as a JobClickEvent (source 'platform'), like every outbound link on the job board. */
  listingId?: string
}

// Prompt 70 — wraps any outbound link to a partner platform (Interim Work
// marketplace listing, job board recommendation) with click tracking. The
// link still navigates normally (target="_blank" means the current tab
// never unmounts) — the tracking call is fire-and-forget, not something
// the click needs to wait on.
export function OutboundPartnerLink({ href, partnerName, section, className, children, listingId }: OutboundPartnerLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        void logPartnerClickThrough(partnerName, section)
        if (listingId) {
          void recordJobClick({ source: 'platform', sourceId: listingId, jobTitle: partnerName, companyName: partnerName, location: null, url: href, fitBucket: null, workType: 'contract' })
        }
      }}
    >
      {children}
    </a>
  )
}
