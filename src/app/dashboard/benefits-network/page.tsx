import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getCatalogListings, type BenefitsNetworkFilters } from '@/lib/benefits-network/listings'
import { getCandidateSkillGapTags, findMatchedSkillGap } from '@/lib/benefits-network/skill-match'
import { isActiveMember } from '@/lib/membership/subscription'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { prisma } from '@/lib/prisma'
import { BenefitsNetworkFilterBar } from '@/components/dashboard/BenefitsNetworkFilterBar'
import { BenefitsNetworkListingCard } from '@/components/dashboard/BenefitsNetworkListingCard'
import { isRedesignOn } from '@/lib/redesign/flag'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { MoreDetails } from '@/components/dashboard/MoreDetails'

export const metadata: Metadata = { title: 'Higher Education Benefits Network' }

type SearchParams = Record<string, string | string[] | undefined>

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function BenefitsNetworkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [profile, params] = await Promise.all([getDashboardProfile(), searchParams])

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

  if (isRedesignOn(profile.email)) {
    // The benefits network in the redesign: a short list of offers with the reason each one fits, the rest behind one fold.
    const card = (listing: (typeof listings)[number]) => (
      <BenefitsNetworkListingCard
        redesign
        key={listing.id}
        listing={listing}
        isRedeemed={redeemedListingIds.has(listing.id)}
        isMember={isMember}
        matchedSkillGap={findMatchedSkillGap(listing.skillGapTags, skillGapTags)}
      />
    )
    return (
      <div className="space-y-8">
        <PageHeader
          title="Higher education benefits network"
          intro="Discounts and programs for NextChapter members, brought in by alumni who know the university, program or certification body. The institution carries the quality, and the alum who sourced it is credited."
          action={isAlum ? <ActionLink variant="primary" href="/dashboard/benefits-network/propose" event="benefits_network_propose_clicked" props={{ source: 'benefits_network_header' }}>Propose an offer</ActionLink> : undefined}
        />
        {!isMember && (
          <p className="text-base text-ink">
            Browsing is open to everyone. Redeeming an offer needs an active{' '}
            <Link href="/dashboard/membership" className="font-medium text-brand underline underline-offset-4">membership</Link>.
          </p>
        )}
        <BenefitsNetworkFilterBar redesign current={filters as Record<string, string | undefined>} />
        {listings.length === 0 ? (
          <EmptyCard title="No offers match those filters" why="Clear a filter, or check back soon as new ones are added." action={<a href="/dashboard/benefits-network" className="text-sm font-medium text-brand underline underline-offset-4">Clear filters</a>} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">{listings.slice(0, 6).map(card)}</div>
            {listings.length > 6 && (
              <MoreDetails summary={`Show more: ${listings.length - 6} more ${listings.length - 6 === 1 ? 'offer' : 'offers'}`}>
                <div className="grid gap-4 sm:grid-cols-2">{listings.slice(6).map(card)}</div>
              </MoreDetails>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Higher Education Benefits Network</h1>
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
