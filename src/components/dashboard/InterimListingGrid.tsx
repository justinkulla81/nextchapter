import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'
import { markInterimMarketplaceSignup } from '@/app/dashboard/interim-work/actions'
import type { InterimListing } from '@prisma/client'

interface InterimListingGridProps {
  listings: InterimListing[]
  signedUpIds: Set<string>
  showSignupCheckbox?: boolean
}

export function InterimListingGrid({ listings, signedUpIds, showSignupCheckbox = false }: InterimListingGridProps) {
  if (listings.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {listings.map((listing) => {
        const signedUp = signedUpIds.has(listing.id)
        return (
          <Card key={listing.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <OutboundPartnerLink
                  href={listing.url}
                  partnerName={listing.name}
                  section="interim_work"
                  className="text-primary underline underline-offset-4"
                >
                  {listing.name}
                </OutboundPartnerLink>
                <span
                  className={
                    listing.designation === 'PARTNER'
                      ? 'rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand'
                      : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                  }
                >
                  {listing.designation === 'PARTNER' ? 'Partner' : 'Included for quality'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{listing.description}</p>
              {listing.designationNote && (
                <p className="text-xs text-muted-foreground italic">{listing.designationNote}</p>
              )}
              {showSignupCheckbox && (
                signedUp ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                    <Check className="size-3.5" /> Profile created
                  </p>
                ) : (
                  <form action={markInterimMarketplaceSignup.bind(null, listing.id)}>
                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                      I created a profile
                    </SubmitButton>
                  </form>
                )
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
