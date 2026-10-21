'use client'

import { usePostHog } from '@/lib/posthog/client'

// A link out to a matched search firm's website or team page, tracked.
export function RecruiterFirmLink({
  href,
  firmId,
  rank,
  kind,
  children,
}: {
  href: string
  firmId: string
  rank: number
  kind: 'website' | 'team'
  children: React.ReactNode
}) {
  const posthog = usePostHog()
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4"
      onClick={() => posthog?.capture('recruiter_list_firm_clicked', { firmId, rank, kind })}
    >
      {children}
    </a>
  )
}
