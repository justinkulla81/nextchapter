import type { MarketResponseSnapshot } from '@/lib/reports/market-response'
import { isMarketResponseAllZero } from '@/lib/reports/market-response'

interface FunnelStage {
  label: string
  value: number
}

export function MarketResponseFunnel({
  marketResponse,
  weekNumber,
}: {
  marketResponse: MarketResponseSnapshot
  weekNumber: number
}) {
  const allZero = isMarketResponseAllZero(marketResponse)
  const replyRate =
    marketResponse.outreachSent > 0
      ? Math.round((marketResponse.repliesReceived / marketResponse.outreachSent) * 100)
      : null

  const stages: FunnelStage[] = [
    { label: 'Outreach sent', value: marketResponse.outreachSent },
    { label: 'Replies', value: marketResponse.repliesReceived },
    { label: 'Conversations', value: marketResponse.conversations },
    { label: 'Referrals', value: marketResponse.referrals },
    { label: 'Interviews', value: marketResponse.interviews },
    { label: 'Offers', value: marketResponse.offers },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {stages.map((stage, i) => (
          <div key={stage.label} className="text-sm">
            <p className="text-xs text-muted-foreground">
              {stage.label}
              {i === 1 && replyRate !== null && ` (${replyRate}%)`}
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{stage.value}</p>
          </div>
        ))}
      </div>
      {marketResponse.paidProjectLeads > 0 && (
        <p className="text-sm text-muted-foreground">
          Plus {marketResponse.paidProjectLeads} paid-project lead
          {marketResponse.paidProjectLeads === 1 ? '' : 's'} this week.
        </p>
      )}
      {allZero && weekNumber <= 3 && (
        <p className="text-sm text-muted-foreground">
          No external signals yet — that&apos;s normal at week {weekNumber}. By week 4, we want to
          see at least one reply or conversation.
        </p>
      )}
      {allZero && weekNumber >= 4 && (
        <p className="text-sm font-medium text-foreground">
          Still no external signals despite real weeks of effort — worth naming honestly: this is
          no longer about doing more, it&apos;s about what to change.
        </p>
      )}
    </div>
  )
}
