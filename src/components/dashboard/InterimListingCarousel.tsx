import { Check } from 'lucide-react'
import { SubmitButton } from '@/components/ui/submit-button'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'
import { markInterimMarketplaceSignup } from '@/app/dashboard/interim-work/actions'
import type { InterimListing } from '@prisma/client'

interface InterimListingCarouselProps {
  listings: InterimListing[]
  signedUpIds: Set<string>
  showSignupCheckbox?: boolean
}

// Same content/logic as InterimListingGrid, laid out as a horizontal
// scroller with a logo up top instead of a grid of cards — styled to match
// the app's other logo carousels (AlumniNetworkCarousel, CuratedVideoCard on
// Videos and Webinars). A listing with no logoUrl on file yet falls back to
// an initial-letter badge rather than a blank/broken image.
export function InterimListingCarousel({ listings, signedUpIds, showSignupCheckbox = false }: InterimListingCarouselProps) {
  if (listings.length === 0) return null

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {listings.map((listing) => {
        const signedUp = signedUpIds.has(listing.id)
        return (
          <div
            key={listing.id}
            className="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex h-20 items-center justify-center bg-muted p-3">
              {listing.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external logo; no remote-image domain configured for next/image
                <img src={listing.logoUrl} alt="" className="max-h-10 max-w-full object-contain" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {listing.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <OutboundPartnerLink
                  href={listing.url}
                  partnerName={listing.name}
                  section="interim_work"
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  {listing.name}
                </OutboundPartnerLink>
                <span
                  className={
                    listing.designation === 'PARTNER'
                      ? 'shrink-0 whitespace-nowrap rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand'
                      : 'shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                  }
                >
                  {listing.designation === 'PARTNER' ? 'Partner' : 'Included for quality'}
                </span>
              </div>
              <p className="line-clamp-3 text-xs text-muted-foreground">{listing.description}</p>
              {listing.designationNote && (
                <p className="text-xs text-muted-foreground italic">{listing.designationNote}</p>
              )}
              {showSignupCheckbox && (
                <div className="mt-auto pt-1">
                  {signedUp ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                      <Check className="size-3.5" /> Profile created
                    </p>
                  ) : (
                    <form action={markInterimMarketplaceSignup.bind(null, listing.id)}>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                        I created a profile
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
