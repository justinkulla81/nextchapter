'use client'

import { posthog } from '@/lib/posthog/client'
import { recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { logPartnerClickThrough } from '@/lib/analytics/partner-click-actions'
import type { ExpertNetworkCard } from '@/lib/jobs/expert-networks'

/** Expert networks that pay for hour-long calls, as one line of links under the fractional jobs. */
export function ExpertNetworkRow({ networks }: { networks: ExpertNetworkCard[] }) {
  if (networks.length === 0) return null

  function onJoin(n: ExpertNetworkCard) {
    posthog.capture('expert_network_join_clicked', { platform: n.name, platformId: n.id, curated: !!n.description })
    void logPartnerClickThrough(n.name, 'interim_work')
    void recordJobClick({ source: 'platform', sourceId: n.id, jobTitle: n.name, companyName: n.name, location: null, url: n.url, fitBucket: null, workType: 'contract' })
  }

  // One line under the jobs (owner, 2026-11-17: the cards and their descriptions crowded the board).
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Paid expert calls:</span>{' '}
      {networks.map((n, i) => (
        <span key={n.id}>
          {i > 0 && ', '}
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onJoin(n)}
            aria-label={`${n.name}${n.stage ? `, ${n.stage}` : ''} (opens in a new tab)`}
            className="text-primary underline underline-offset-4"
          >
            {n.name}
          </a>
          {n.stage && ` (${n.stage.toLowerCase()})`}
        </span>
      ))}
    </p>
  )
}
