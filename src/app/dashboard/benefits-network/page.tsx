import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getCatalogListings, type BenefitsNetworkFilters } from '@/lib/benefits-network/listings'
import { getCandidateSkillGapTags, findMatchedSkillGap } from '@/lib/benefits-network/skill-match'
import { isActiveMember } from '@/lib/membership/subscription'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { prisma } from '@/lib/prisma'
import { BenefitsNetworkFilterBar } from '@/components/dashboard/BenefitsNetworkFilterBar'
import { BenefitsNetworkListingCard } from '@/components/dashboard/BenefitsNetworkListingCard'

export const metadata: Metadata = { title: 'Alumni Benefits Network' }

type SearchParams = Record<string, string | string[] | undefined>

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function BenefitsNetworkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await getDashboardData()
  const params = await searchParams

  const filters: BenefitsNetworkFilters = {
    function: firstValue(params.function) || undefined,
    level: firstValue(params.level) || undefined,
    format: firstValue(params.format) || undefined,
    costType: firstValue(params.costType) || undefined,
    timeCommitment: firstValue(params.timeCommitment) || undefined,
    credentialType: firstValue(params.credentialType) || undefined,
  }

  const [listings, skillGapTags, isMember, isAlum, redemptions] = await Promise.all([
    getCatalogListings(filters),
    getCandidateSkillGapTags(profile.id),
    isActiveMember(profile.id),
    hasRoleGrant(profile.userId, 'alum'),
    prisma.benefitsNetworkRedemption.findMany({ where: { candidateId: profile.id }, select: { listingId: true } }),
  ])
  const redeemedListingIds = new Set(redemptions.map((r) => r.listingId))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Alumni Benefits Network</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Discounts and programs offered to NextChapter members, sourced through relationships our own alumni have
            at universities, exec-ed programs, professional associations, and certification bodies. The institution
            carries the quality; the alum who sourced it is always credited.
          </p>
        </div>
        {isAlum && (
          <Link href="/dashboard/benefits-network/propose" className="shrink-0 text-sm text-primary underline underline-offset-4">
            Propose an offer →
          </Link>
        )}
      </div>

      {!isMember && (
        <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4 text-sm text-muted-foreground">
          Browsing is open to everyone — redeeming an offer requires an active{' '}
          <Link href="/dashboard/membership" className="text-primary underline underline-offset-4">
            Membership
          </Link>
          .
        </div>
      )}

      <BenefitsNetworkFilterBar current={filters as Record<string, string | undefined>} />

      {listings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No offers match those filters right now — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {listings.map((listing) => (
            <BenefitsNetworkListingCard
              key={listing.id}
              listing={listing}
              isRedeemed={redeemedListingIds.has(listing.id)}
              isMember={isMember}
              matchedSkillGap={findMatchedSkillGap(listing.skillGapTags, skillGapTags)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
