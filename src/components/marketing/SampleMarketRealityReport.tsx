import { MarketRealityOverview } from '@/components/dashboard/MarketRealityOverview'
import { SAMPLE_CANDIDATE_LABEL, SAMPLE_MARKET_REALITY_PROPS } from '@/lib/marketing/sample-market-reality'

// Renders the REAL MarketRealityOverview component (the same one a logged-in
// candidate sees on their dashboard) fed with fully invented data for a
// fictional candidate — Partners Master Build Script §C3.1/§C3.2: "proof of
// the diagnosis... real output beats any description," and "no page ships
// without a real artifact."
export function SampleMarketRealityReport() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sample report — {SAMPLE_CANDIDATE_LABEL}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          Illustrative, not a real person
        </span>
      </div>
      <MarketRealityOverview {...SAMPLE_MARKET_REALITY_PROPS} />
    </div>
  )
}
