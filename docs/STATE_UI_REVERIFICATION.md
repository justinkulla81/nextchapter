# State unemployment benefits: yearly re-verification

The `/unemployment-benefits/[state]` pages publish benefit amounts and rules
from `src/lib/data/state-ui.ts`. People who just lost a job act on these
numbers, so they are re-verified every year and whenever a state changes its
law.

## When

- **Every January**, after the U.S. Department of Labor publishes the new
  "Significant Provisions of State UI Laws" (usually effective January 1).
- **Every July**, for states whose maximum weekly benefit changes mid-year
  (check the July edition of Significant Provisions).
- **Weekly is not needed** for Extended Benefits status: re-check it whenever
  the pages are regenerated, from the latest DOL Trigger Notice.
- **When a state legislature changes its UI law** (news, the state agency's
  site, or a DOL UIPL).

## Sources (official only)

1. DOL ETA, Significant Provisions of State UI Laws, latest edition:
   https://oui.doleta.gov/unemploy/statelaws.asp
2. DOL ETA, Comparison of State Unemployment Insurance Laws, latest edition
   (Chapter 3 for severance and pay in lieu of notice, Chapter 5 for work
   search): https://oui.doleta.gov/unemploy/statelaws.asp
3. DOL Extended Benefits Trigger Notice, latest:
   https://oui.doleta.gov/unemploy/claims_arch.asp
4. Each state UI agency's own site, to confirm or fill a gap.

Never use a third-party summary as the source of a number.

## Checklist

- [ ] Download the new Significant Provisions edition. For every state, compare
      max and min weekly benefit (without dependents), maximum weeks, whether
      duration varies with the unemployment rate, and the waiting week.
- [ ] Update each changed field's `value`, `source` and `asOf`.
- [ ] Download the new Comparison edition. Re-read the severance, pay in lieu
      of notice and work-search entries for every state; update text, source
      and `asOf`.
- [ ] Check the latest Trigger Notice and update `extendedBenefits` for every
      state.
- [ ] Open every `fileUrl` and confirm it still lands on the state's
      initial-claim page.
- [ ] Where two official sources disagree, set the value to `null` and add a
      `note`; the page then says "Check with <agency>". Never estimate.
- [ ] Update `UI_LAST_VERIFIED` in `state-ui.ts`.
- [ ] Build, spot-check five state pages against the source PDFs, deploy, and
      run IndexNow for the changed pages.
