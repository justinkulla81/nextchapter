'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'

// PostHog on the one real interactive element a comparison page has — the
// RFP template CTA — per CLAUDE.md's "wire analytics into every new
// feature at build time" and this phase's own instructions.
export function ComparisonCtaLink({ competitorSlug }: { competitorSlug: string }) {
  const posthog = usePostHog()

  return (
    <Link
      href="/rfp-template"
      onClick={() => posthog?.capture('comparison_page_rfp_cta_clicked', { competitorSlug })}
      className="mt-6 inline-flex items-center justify-center rounded-md bg-success px-6 py-3 text-sm font-medium text-white hover:bg-success-hover"
    >
      Get the RFP template
    </Link>
  )
}
