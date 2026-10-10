'use client'

import posthog from 'posthog-js'

// Link out to the SEC filing behind a likely-opening signal, tracked so we
// can see which surfaces send people to the source.
export function LikelyOpeningFilingLink({
  likelyOpeningId,
  companyName,
  signalType,
  href,
  source,
  label = 'Read the SEC filing',
}: {
  likelyOpeningId: string
  companyName: string
  signalType: string
  href: string
  source: 'company_tracker' | 'admin'
  label?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} for ${companyName}`}
      onClick={() => posthog.capture('likely_opening_filing_opened', { likelyOpeningId, companyName, signalType, source })}
      className="text-primary hover:underline"
    >
      {label}
    </a>
  )
}
