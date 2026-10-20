'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'

// An outbound course link that also tells PostHog which course was opened and from where on Learn.
export function CourseLink({ href, partnerName, title, slot, hasReason, className, children }: { href: string; partnerName: string; title: string; slot: 'featured' | 'more'; hasReason: boolean; className?: string; children: ReactNode }) {
  return (
    <span onClickCapture={() => posthog.capture('learn_course_opened', { title, provider: partnerName, slot, hasReason })} className="contents">
      <OutboundPartnerLink href={href} partnerName={partnerName} section={`learn-${slot}`} className={className}>
        {children}
      </OutboundPartnerLink>
    </span>
  )
}
