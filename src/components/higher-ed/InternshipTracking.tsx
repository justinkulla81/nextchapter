'use client'

import { useEffect, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// PostHog for the Higher Ed portal's Internships tab: one view event per list
// shown (with what was filtered), one click event per posting opened.

export function InternshipsViewed({ institutionId, count, filters, demo }: { institutionId: string; count: number; filters: Record<string, string | boolean | undefined>; demo: boolean }) {
  const key = JSON.stringify(filters)
  useEffect(() => {
    posthog.capture('higher_ed_internships_viewed', { institutionId, count, filters: JSON.parse(key), demo })
  }, [institutionId, count, key, demo])
  return null
}

export function InternshipLink({ institutionId, jobId, href, demo, children }: { institutionId: string; jobId: string; href: string; demo: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => posthog.capture('higher_ed_internship_clicked', { institutionId, jobId, demo })}
      className="text-sm font-medium text-primary hover:underline"
    >
      {children}
    </a>
  )
}
