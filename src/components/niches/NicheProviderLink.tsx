'use client'

import { usePostHog } from '@/lib/posthog/client'

// PostHog on the one interactive element of a niche page: the outbound link to a company's own site.
export function NicheProviderLink({ nicheSlug, provider, host, url }: { nicheSlug: string; provider: string; host: string; url: string }) {
  const posthog = usePostHog()
  return (
    <a
      href={url}
      target="_blank"
      rel="nofollow noopener noreferrer"
      onClick={() => posthog?.capture('niche_provider_link_clicked', { niche: nicheSlug, provider, host })}
      className="font-medium text-brand underline underline-offset-2 hover:text-navy"
    >
      {provider}
    </a>
  )
}
