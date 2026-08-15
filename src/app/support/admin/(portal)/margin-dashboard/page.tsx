import { requireAdmin } from '@/lib/admin/auth'

// Placeholder shell — Master Build Script §A9: "realized gross margin per
// seat by tier, flagging any contract below the 45% floor." Real margin
// computation needs real Employer contract/seat data (seats sold, tier,
// discount, actual coaching/recruiter/data cost incurred per seat), and
// that entity doesn't exist yet — it ships with Phase 4's Employer portal
// (the EmployerSeat model that exists today belongs to the unrelated,
// pre-existing /talent self-serve SaaS product and is deliberately not
// reused here). This page is an honest empty state, not a gap: once
// Phase 4 lands an Employer contract/seat model, wire its real seat count,
// tier, and cost data in here instead of fabricating numbers.
export default async function MarginDashboardAdminPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Margin dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Realized gross margin per seat, by tier, flagging any contract below the 45% floor — Master Build Script
          §A9.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border p-6">
        <p className="text-sm font-medium">No employer contracts yet.</p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          This dashboard reads realized cost against seats sold, by employer contract and tier. No Employer contract
          or seat model exists yet — that ships with the Employer portal. Unit-economics targets are configured
          below for reference; live margin will populate here once contracts exist.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Target unit economics, per seat (§A2.2)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Price / seat</th>
                <th className="py-2 pr-4 font-medium">Target cost</th>
                <th className="py-2 font-medium">Target margin</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">Core</td>
                <td className="py-2 pr-4">$895</td>
                <td className="py-2 pr-4">$160</td>
                <td className="py-2">82%</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">Plus</td>
                <td className="py-2 pr-4">$2,450</td>
                <td className="py-2 pr-4">$865</td>
                <td className="py-2">65%</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Premium</td>
                <td className="py-2 pr-4">$7,450</td>
                <td className="py-2 pr-4">$3,000</td>
                <td className="py-2">
                  60% <span className="text-muted-foreground">— floor 45%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
