// The single source of truth for "portfolio assets you have" — both the
// hamburger-nav badge (dashboard/layout.tsx) and the Portfolio page itself
// call buildPortfolioAssetChecklist with the same boolean inputs, so the
// two can never drift out of sync the way they previously did (the nav
// badge summed raw, uncapped counts while the page capped each category at
// one — this type signature makes that class of bug impossible: every
// input here is a boolean, not a count).
export interface PortfolioAssetInputs {
  hasResume: boolean
  hasCoverLetter: boolean
  hasNarrative: boolean
  hasMarketRealityReport: boolean
  hasMarketRealitySnapshot: boolean
  hasWorkSample: boolean
  hasCompletedReference: boolean
  hasLearningBadge: boolean
}

export const PORTFOLIO_ASSET_LABELS: Record<keyof PortfolioAssetInputs, string> = {
  hasResume: 'Resume',
  hasCoverLetter: 'A cover letter',
  hasNarrative: 'Your narrative',
  hasMarketRealityReport: 'Market Reality Report',
  hasMarketRealitySnapshot: 'A weekly grade snapshot',
  hasWorkSample: 'A work sample',
  hasCompletedReference: 'A completed reference',
  hasLearningBadge: 'A learning credential',
}

export interface PortfolioAsset {
  key: keyof PortfolioAssetInputs
  label: string
  done: boolean
}

export function buildPortfolioAssetChecklist(inputs: PortfolioAssetInputs): PortfolioAsset[] {
  return (Object.keys(PORTFOLIO_ASSET_LABELS) as (keyof PortfolioAssetInputs)[]).map((key) => ({
    key,
    label: PORTFOLIO_ASSET_LABELS[key],
    done: inputs[key],
  }))
}
