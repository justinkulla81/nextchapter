import { formatDate } from '@/lib/crm/labels'
import { label, type ApplicantKind } from '@/lib/funding-opportunities/eligibility'
import type { StoredOpportunity } from '@/lib/funding-opportunities/store'

const HOW: Record<StoredOpportunity['eligibility'], string> = {
  DIRECT: 'Apply directly',
  VIA_PARTNER: 'Via partner',
  UNKNOWN: 'Eligibility unconfirmed',
}

const DAY = 86_400_000

/** "Open funding you could pursue": grants this organization could apply for, with NextChapter backed in. */
export function CrmFundingMatches({ opportunities, now = new Date() }: { opportunities: StoredOpportunity[]; now?: Date }) {
  if (opportunities.length === 0) return null
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">Open funding you could pursue</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Federal grants this organization is eligible to apply for. Where it is eligible and we are not, the grant is for
        them to win and NextChapter is the partner that delivers it.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {opportunities.map((o) => {
          const days = o.closesAt ? Math.ceil((o.closesAt.getTime() - now.getTime()) / DAY) : null
          const closingSoon = days !== null && days <= 14
          return (
            <li key={o.id} className="space-y-1 p-3 text-sm">
              <a href={o.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{o.title}</a>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{o.agency}</span>
                <span className="rounded border border-border px-1.5 py-0.5">{HOW[o.eligibility]}</span>
                {o.closesAt && (
                  <span className={closingSoon ? 'font-medium text-foreground' : undefined}>
                    Closes {formatDate(o.closesAt)}{days !== null && days >= 0 ? ` (${days} days)` : ''}
                  </span>
                )}
                {o.awardCeiling ? <span>Up to ${Math.round(o.awardCeiling).toLocaleString('en-US')}</span> : null}
              </div>
              {o.eligibility === 'VIA_PARTNER' && o.partnerKinds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Applicants: {(o.partnerKinds as ApplicantKind[]).map(label).join(', ')}.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
