'use client'

import { ExternalLink } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { logPartnerClickThrough } from '@/lib/analytics/partner-click-actions'
import type { ExpertNetworkCard } from '@/lib/jobs/expert-networks'

/** "Get paid for your expertise" — expert networks at the top of the Contract & 1099 view. */
export function ExpertNetworkRow({ networks }: { networks: ExpertNetworkCard[] }) {
  if (networks.length === 0) return null

  function onJoin(n: ExpertNetworkCard) {
    posthog.capture('expert_network_join_clicked', { platform: n.name, platformId: n.id, curated: !!n.description })
    void logPartnerClickThrough(n.name, 'interim_work')
    void recordJobClick({ source: 'platform', sourceId: n.id, jobTitle: n.name, companyName: n.name, location: null, url: n.url, fitBucket: null, workType: 'contract' })
  }

  const featured = networks.filter((n) => n.description)
  const more = networks.filter((n) => !n.description)
  return (
    <section aria-labelledby="expert-networks-heading" className="space-y-2">
      <div>
        <h3 id="expert-networks-heading" className="text-sm font-semibold text-foreground">
          Get paid for your expertise
        </h3>
        <p className="text-xs text-muted-foreground">
          Expert networks pay for hour-long calls with investors and consultants who need what you know. Free to join; a
          good fit alongside a search.
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {featured.map((n) => (
          <div key={n.id} className="flex w-56 shrink-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              {n.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external logo; no remote-image domain configured for next/image
                <img src={n.logoUrl} alt="" className="h-6 max-w-16 object-contain" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{n.name.charAt(0)}</span>
              )}
              <p className="truncate text-sm font-medium text-foreground">{n.name}</p>
            </div>
            <p className="line-clamp-3 text-xs text-muted-foreground">{n.description}</p>
            <div className="mt-auto flex items-center justify-between gap-2">
              {n.stage ? <span className="text-xs text-success">{n.stage}</span> : <span />}
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onJoin(n)}
                aria-label={`Join ${n.name} (opens in a new tab)`}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                {n.stage ? 'Open' : 'Join'} <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          </div>
        ))}
      </div>
      {more.length > 0 && (
        <p className="text-xs text-muted-foreground">
          More networks:{' '}
          {more.map((n, i) => (
            <span key={n.id}>
              {i > 0 && ', '}
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onJoin(n)}
                className="text-primary underline underline-offset-4"
              >
                {n.name}
              </a>
              {n.stage && ` (${n.stage})`}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}
