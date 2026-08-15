'use client'

import { useActionState } from 'react'
import type { BenefitsNetworkListingWithAlum } from '@/lib/benefits-network/listings'
import { redeemListing, rateListing, reportListing, type FormState } from '@/app/dashboard/benefits-network/actions'
import { SubmitButton } from '@/components/ui/submit-button'

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

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      {matchedSkillGap && (
        <p className="rounded-md bg-brand/8 px-3 py-1.5 text-xs font-medium text-brand">
          Matches a skill gap in your Dossier: {matchedSkillGap}
        </p>
      )}

      <div>
        <h3 className="font-semibold text-foreground">{listing.programName}</h3>
        <p className="text-sm text-muted-foreground">{listing.institutionName}</p>
      </div>

      <p className="text-sm text-foreground">{listing.discountDescription}</p>
      <p className="text-sm text-muted-foreground">{listing.description}</p>

      <div className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Full cost: </span>
        {listing.fullCostNote}
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {[listing.function, listing.level, listing.format, listing.costType, listing.timeCommitment, listing.credentialType].map(
          (tag) => (
            <span key={tag} className="rounded-full bg-light-gray px-2 py-0.5">
              {tag}
            </span>
          )
        )}
        {listing.seatCount != null && (
          <span className="rounded-full bg-light-gray px-2 py-0.5">{listing.seatCount} seats</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Sourced by {alumName}, a NextChapter alum{listing.institutionDomain ? ` — confirmed at ${listing.institutionDomain}` : ''}.
        {listing.avgRating != null && (
          <>
            {' '}
            {listing.avgRating.toFixed(1)}/5 average ({listing._count.ratings} rating{listing._count.ratings === 1 ? '' : 's'}).
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isRedeemed ? (
          <div className="rounded-md border border-success/30 bg-success/10 p-2.5 text-sm text-success">
            <p className="font-medium">Redeemed — {listing.redemptionMethod === 'CODE' ? 'your code' : 'instructions'}: {listing.redemptionValue}</p>
            <p className="mt-0.5 text-xs">{listing.redemptionInstructions}</p>
          </div>
        ) : (
          <form action={redeemAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <SubmitButton
              size="sm"
              pendingLabel="Redeeming…"
              disabled={!isMember}
              title={!isMember ? 'Redeeming Benefits Network offers requires an active Membership' : undefined}
            >
              {isMember ? 'Redeem this offer' : 'Members only — redeem'}
            </SubmitButton>
          </form>
        )}

        {!isMember && (
          <a href="/dashboard/membership" className="text-xs text-primary underline underline-offset-4">
            Become a Member to redeem
          </a>
        )}
      </div>
      {redeemState?.error && <p className="text-xs text-destructive">{redeemState.error}</p>}

      {isRedeemed && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Rate this offer</summary>
          <form action={rateAction} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="listingId" value={listing.id} />
            <div className="space-y-1">
              <label htmlFor={`rating-${listing.id}`} className="block text-xs text-muted-foreground">
                Rating (1-5)
              </label>
              <select id={`rating-${listing.id}`} name="rating" className="rounded-md border border-input px-2 py-1.5 text-sm" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <input
              name="comment"
              placeholder="Optional comment"
              className="min-w-[160px] flex-1 rounded-md border border-input px-2 py-1.5 text-sm"
            />
            <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
              Submit rating
            </SubmitButton>
          </form>
          {rateState?.error && <p className="mt-1 text-xs text-destructive">{rateState.error}</p>}
          {rateState?.success && <p className="mt-1 text-xs text-success">{rateState.success}</p>}
        </details>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Report this offer</summary>
        <form action={reportAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="listingId" value={listing.id} />
          <input
            name="reason"
            placeholder="What went wrong? (optional)"
            className="min-w-[200px] flex-1 rounded-md border border-input px-2 py-1.5 text-sm"
          />
          <SubmitButton size="sm" variant="outline" pendingLabel="Reporting…">
            Report
          </SubmitButton>
        </form>
        {reportState?.error && <p className="mt-1 text-xs text-destructive">{reportState.error}</p>}
        {reportState?.success && <p className="mt-1 text-xs text-success">{reportState.success}</p>}
      </details>
    </div>
  )
}
