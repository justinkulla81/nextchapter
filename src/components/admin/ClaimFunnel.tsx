import type { ClaimFunnelData } from '@/lib/admin/claim-funnel'

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(part / whole >= 0.1 ? 0 : 1)}%` : '–')

// The claim funnel for the admin funnel page: public organization pages, the claim page, claim requests, verified claims.
export function ClaimFunnel({ data }: { data: ClaimFunnelData }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">4 · Claim your page (B2B)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The public college, workforce board, job center, economic development and employer pages each lead to a claim page. Visitors per kind of page, and how many
          arrived at a claim page from it. Claim pages also get visitors from outreach emails, so the claim-page total is larger than the sum of the rows.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-1 font-normal">Kind of page</th>
            <th className="pb-1 text-right font-normal">Visitors</th>
            <th className="pb-1 text-right font-normal">Reached a claim page</th>
            <th className="pb-1 text-right font-normal">Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.kinds.map((k) => (
            <tr key={k.key} className="border-t align-top">
              <td className="py-1.5">
                <div className="font-medium">{k.label}</div>
                <div className="text-xs text-muted-foreground">{k.where}</div>
              </td>
              <td className="py-1.5 text-right tabular-nums">{k.visitors.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">{k.toClaimPage.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">{pct(k.toClaimPage, k.visitors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Claim-page visitors (all sources)</dt>
          <dd className="text-lg font-semibold tabular-nums">{data.claimPageVisitors.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Asked to claim</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {data.claimRequests.toLocaleString('en-US')} <span className="text-xs font-normal text-muted-foreground">{pct(data.claimRequests, data.claimPageVisitors)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Verified</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {data.verified.toLocaleString('en-US')} <span className="text-xs font-normal text-muted-foreground">{pct(data.verified, data.claimRequests)} of requests</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Waiting for a person to review</dt>
          <dd className="text-lg font-semibold tabular-nums">{data.needsReview.toLocaleString('en-US')}</dd>
        </div>
      </dl>
    </section>
  )
}
