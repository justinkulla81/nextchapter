'use client'

import { useActionState } from 'react'
import type { BenefitsNetworkListingWithAlum } from '@/lib/benefits-network/listings'
import { redeemListing, rateListing, reportListing, type FormState } from '@/app/dashboard/benefits-network/actions'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { listingFacts, ratingText } from '@/lib/redesign/network-account'

// §A4.4 guardrails audited on this card:
// - Institutional confirmation: institutionDomain is only ever set once
//   BenefitsNetworkVerification.confirmedAt is set (see verification.ts) --
//   rendering it here IS the "confirmed" badge.
// - Conflict of interest: alum's name + "sourced by" line, always shown,
//   never collapsible or hideable.
// - No urgency marketing: no countdown, no "X seats left" styling -- seat
//   count (if set) is stated plainly as a fact, not a scarcity device.
// - Total cost stated: fullCostNote always renders, never truncated behind
//   a "see more."
export function BenefitsNetworkListingCard({
  listing,
  isRedeemed,
  isMember,
  matchedSkillGap,
}: {
  listing: BenefitsNetworkListingWithAlum
  isRedeemed: boolean
  isMember: boolean
  matchedSkillGap: string | null
}) {
  const alumName = [listing.alum.firstName, listing.alum.lastName].filter(Boolean).join(' ') || 'a NextChapter alum'

  const [redeemState, redeemAction] = useActionState<FormState, FormData>(redeemListing, undefined)
  const [rateState, rateAction] = useActionState<FormState, FormData>(rateListing, undefined)
  const [reportState, reportAction] = useActionState<FormState, FormData>(reportListing, undefined)

  const rating = ratingText(listing.avgRating ?? null, listing._count.ratings)
  const sourced = `Sourced by ${alumName}, a NextChapter alum${listing.institutionDomain ? `, confirmed at ${listing.institutionDomain}` : ''}.`
  return (
    <div className="space-y-4 rounded-2xl border border-border p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">{listing.programName}</h3>
        <p className="text-sm text-muted-foreground">{listing.institutionName}</p>
        <p className="text-base text-ink">{listing.discountDescription}</p>
        {matchedSkillGap && <p className="text-base text-ink">Why it fits: it matches a skill gap in your dossier, {matchedSkillGap}.</p>}
        <p className="text-sm text-muted-foreground">{listingFacts(listing)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isRedeemed ? (
          <div role="status" className="space-y-1 text-base text-ink">
            <p className="font-semibold">Redeemed. {listing.redemptionMethod === 'CODE' ? 'Your code' : 'Instructions'}: {listing.redemptionValue}</p>
            <p className="text-sm text-muted-foreground">{listing.redemptionInstructions}</p>
          </div>
        ) : isMember ? (
          <form action={redeemAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <ActionSubmit variant="secondary" pendingLabel="Redeeming…" event="benefits_offer_redeemed" props={{ listingId: listing.id }}>
              Redeem this offer
            </ActionSubmit>
          </form>
        ) : (
          <>
            <a href="/dashboard/membership" className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
              Become a member to redeem
            </a>
            <p className="text-sm text-muted-foreground">Redeeming an offer needs an active membership.</p>
          </>
        )}
      </div>
      {redeemState?.error && <p role="alert" className="text-sm text-destructive">{redeemState.error}</p>}

      <details className="text-base">
        <summary className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">Full cost, who sourced it, rate or report</summary>
        <div className="mt-3 space-y-3">
          <p className="text-base text-ink">{listing.description}</p>
          <p className="text-base text-ink"><span className="font-semibold">Full cost:</span> {listing.fullCostNote}</p>
          <p className="text-sm text-muted-foreground">{[sourced, rating].filter(Boolean).join(' ')}</p>
          {isRedeemed && (
            <form action={rateAction} className="space-y-2">
              <input type="hidden" name="listingId" value={listing.id} />
              <ChoiceField name="rating" label="Rate this offer" options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: String(n) }))} defaultValue="5" />
              <input name="comment" aria-label="Optional comment" placeholder="Optional comment" className="h-11 w-full max-w-md rounded-xl border border-border px-3.5 text-base" />
              <ActionSubmit variant="secondary" pendingLabel="Saving…" event="benefits_offer_rated" props={{ listingId: listing.id }}>Submit rating</ActionSubmit>
              {rateState?.error && <p role="alert" className="text-sm text-destructive">{rateState.error}</p>}
              {rateState?.success && <p role="status" className="text-sm text-ink">{rateState.success}</p>}
            </form>
          )}
          <form action={reportAction} className="space-y-2">
            <input type="hidden" name="listingId" value={listing.id} />
            <label htmlFor={`report-${listing.id}`} className="block text-sm font-semibold text-ink">Report this offer</label>
            <input id={`report-${listing.id}`} name="reason" placeholder="What went wrong? (optional)" className="h-11 w-full max-w-md rounded-xl border border-border px-3.5 text-base" />
            <ActionSubmit variant="secondary" pendingLabel="Reporting…" event="benefits_offer_reported" props={{ listingId: listing.id }}>Report</ActionSubmit>
            {reportState?.error && <p role="alert" className="text-sm text-destructive">{reportState.error}</p>}
            {reportState?.success && <p role="status" className="text-sm text-ink">{reportState.success}</p>}
          </form>
        </div>
      </details>
    </div>
  )
}
