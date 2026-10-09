'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'

// PostHog events for the ranked company directory (CLAUDE.md: analytics ship
// with the feature). Deliberately carries IDs, rank and band only — never
// the reasons text or any per-candidate profile value, so the events can't
// be used to reconstruct who a person is or what they've told us.

export function CompanyDirectoryViewed({
  sort,
  resultCount,
  page,
  hasFilters,
  hasQuery,
}: {
  sort: 'fit' | 'az'
  resultCount: number
  page: number
  hasFilters: boolean
  hasQuery: boolean
}) {
  const posthog = usePostHog()
  useEffect(() => {
    posthog?.capture('company_directory_viewed', { sort, resultCount, page, hasFilters, hasQuery })
    // One event per distinct view of the list (sort/filters/page change is a
    // new view), not per re-render.
  }, [posthog, sort, resultCount, page, hasFilters, hasQuery])
  return null
}

export function RankedCompanyLink({
  href,
  companyId,
  rank,
  band,
  sort,
  className,
  children,
}: {
  href: string
  companyId: string
  rank: number | null
  band: 'strong' | 'worth_a_look' | 'long_shot' | null
  sort: 'fit' | 'az'
  className?: string
  children: React.ReactNode
}) {
  const posthog = usePostHog()
  return (
    <Link
      href={href}
      className={className}
      onClick={() => posthog?.capture('company_directory_company_opened', { companyId, rank, band, sort })}
    >
      {children}
    </Link>
  )
}
