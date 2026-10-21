import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PayPosition } from '@/components/market/PayPosition'
import { OfferedWagesSection } from '@/components/market/OfferedWagesSection'
import { AdzunaMarketSection, AdzunaMarketSectionLoading } from '@/components/market/AdzunaMarketSection'
import { isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'
import { InlineLoadingState } from '@/components/ui/spinner'
import { type WorkValueDomain } from '@/lib/constants/what-i-need'
import { benefitsAsks } from '@/lib/review-prep/benefits'
import { PayRedesign } from '@/components/market/PayRedesign'

export const metadata: Metadata = { title: 'Know your worth' }

// Know your worth: where your pay sits, what employers are advertising for
// your role, and what else matters to you besides salary. Useful at every
// stage (a raise, a promotion, an offer, a move) and the page "Know your worth"
// in the menu opens for people managing their career.
export default async function PayPage() {
  const profile = await getDashboardProfile()
  const need = await prisma.whatINeedResponse.findUnique({ where: { candidateId: profile.id }, select: { domainRank: true } })
  const top = ((need?.domainRank ?? []) as WorkValueDomain[]).slice(0, 3)
  const asks = benefitsAsks(profile)
  return (
    <PayRedesign
      top={top}
      asks={asks}
      position={
        <Suspense fallback={<InlineLoadingState label="Comparing your pay with the market" />}>
          <PayPosition candidateId={profile.id} />
        </Suspense>
      }
      filed={
        <Suspense fallback={<InlineLoadingState label="Looking up public wage filings" />}>
          <OfferedWagesSection candidateId={profile.id} />
        </Suspense>
      }
      market={
        isAdzunaInsightsEnabled() ? (
          <Suspense fallback={<AdzunaMarketSectionLoading />}>
            <AdzunaMarketSection candidateId={profile.id} scope="state" />
          </Suspense>
        ) : null
      }
    />
  )
}
