import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createInterimListing, toggleInterimListingActive } from './actions'
import { InterimListingCreateForm } from '@/components/admin/InterimListingCreateForm'
import { InterimListingDesignationForm } from '@/components/admin/InterimListingDesignationForm'
import { InterimListingLogoForm } from '@/components/admin/InterimListingLogoForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { InterimListingCategory } from '@prisma/client'

export const maxDuration = 30

const CATEGORY_LABELS: Record<InterimListingCategory, string> = {
  MARKETPLACE_TECHNICAL: 'Marketplace — technical/AI',
  MARKETPLACE_GENERAL: 'Marketplace — general (ops/strategy/finance)',
  MARKETPLACE_MARKETING: 'Marketplace — marketing',
  MARKETPLACE_STARTUP: 'Marketplace — startup-stage operator',
  MARKETPLACE_ANY_FUNCTION: 'Marketplace — any function',
  EXPERT_NETWORK: 'Expert network',
  BOARD_ADVISORY: 'Board & advisory',
  NONPROFIT_BOARD: 'Nonprofit board',
}

export default async function InterimListingsAdminPage() {
  await requireAdmin()

  const listings = await prisma.interimListing.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  const byCategory = new Map<InterimListingCategory, typeof listings>()
  for (const listing of listings) {
    const group = byCategory.get(listing.category) ?? []
    group.push(listing)
    byCategory.set(listing.category, group)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interim Work Listings</h1>
        <p className="mt-1 text-muted-foreground">
          The fractional-marketplace, expert-network, and board/advisory listings shown on
          candidates&apos; Interim Work page. Partner means a confirmed revenue arrangement exists;
          Included for quality means it&apos;s a real, relevant option with no revenue claim.
          Changes here take effect immediately — no deploy needed.
        </p>
      </div>

      <InterimListingCreateForm action={createInterimListing} />

      <div className="space-y-8">
        {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
          const group = byCategory.get(category as InterimListingCategory) ?? []
          if (group.length === 0) return null
          return (
            <div key={category} className="space-y-3">
              <h2 className="text-lg font-semibold">{label}</h2>
              <div className="space-y-3">
                {group.map((listing) => (
                  <Card key={listing.id}>
                    <CardContent className="flex items-start justify-between gap-4 pt-6">
                      <div>
                        <p className="font-medium">
                          {listing.name}
                          {!listing.isActive && (
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Inactive
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{listing.description}</p>
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline underline-offset-4"
                        >
                          {listing.url}
                        </a>
                        {listing.designationNote && (
                          <p className="mt-1 text-xs italic text-muted-foreground">{listing.designationNote}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <InterimListingDesignationForm listingId={listing.id} designation={listing.designation} />
                        <InterimListingLogoForm listingId={listing.id} logoUrl={listing.logoUrl} />
                        <form action={toggleInterimListingActive.bind(null, listing.id, listing.isActive)}>
                          <SubmitButton variant="ghost" size="sm">
                            {listing.isActive ? 'Deactivate' : 'Activate'}
                          </SubmitButton>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
