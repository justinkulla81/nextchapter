import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PayPosition } from '@/components/market/PayPosition'
import { OfferedWagesSection } from '@/components/market/OfferedWagesSection'
import { AdzunaMarketSection, AdzunaMarketSectionLoading } from '@/components/market/AdzunaMarketSection'
import { isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'
import { InlineLoadingState } from '@/components/ui/spinner'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { Button } from '@/components/ui/button'
import { benefitsAsks } from '@/lib/review-prep/benefits'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PayRedesign } from '@/components/market/PayRedesign'
import { WORK_VALUE_DOMAIN_LABELS, type WorkValueDomain } from '@/lib/constants/what-i-need'

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
  const redesign = isRedesignOn(profile.email)

  if (redesign) {
    return (
      <PayRedesign
        top={top}
        asks={asks}
        position={
          <Suspense fallback={<InlineLoadingState label="Comparing your pay with the market" />}>
            <PayPosition candidateId={profile.id} redesign />
          </Suspense>
        }
        filed={
          <Suspense fallback={<InlineLoadingState label="Looking up public wage filings" />}>
            <OfferedWagesSection candidateId={profile.id} redesign />
          </Suspense>
        }
        market={
          isAdzunaInsightsEnabled() ? (
            <Suspense fallback={<AdzunaMarketSectionLoading />}>
              <AdzunaMarketSection candidateId={profile.id} scope="state" redesign />
            </Suspense>
          ) : null
        }
      />
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Know your worth</h1>
          <p className="mt-1 text-muted-foreground">Where your pay sits and what the market says, before a review, a raise, an offer or a move. Private to you.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/review-prep" />}>
          Build your case for the conversation
        </Button>
      </div>

      <section className="space-y-3" aria-labelledby="your-pay">
        <h2 id="your-pay" className="text-lg font-semibold">
          Where your pay sits
        </h2>
        <Suspense fallback={<InlineLoadingState label="Comparing your pay with the market" />}>
          <PayPosition candidateId={profile.id} />
        </Suspense>
      </section>

      <section className="space-y-3" aria-labelledby="filed">
        <h2 id="filed" className="text-lg font-semibold">
          What employers have filed to pay
        </h2>
        <Suspense fallback={<InlineLoadingState label="Looking up public wage filings" />}>
          <OfferedWagesSection candidateId={profile.id} />
        </Suspense>
      </section>

      <MoreDetails summary="The market for your role and what matters besides pay">
      {isAdzunaInsightsEnabled() && (
        <section className="space-y-3" aria-labelledby="market">
          <h2 id="market" className="text-lg font-semibold">
            The market for your role
          </h2>
          <Suspense fallback={<AdzunaMarketSectionLoading />}>
            <AdzunaMarketSection candidateId={profile.id} scope="state" />
          </Suspense>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="besides-pay">
        <h2 id="besides-pay" className="text-lg font-semibold">
          What matters besides pay
        </h2>
        {top.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              From What I Need, the things you said you will not trade away, most important first:{' '}
              <span className="font-medium text-foreground">{top.map((d) => WORK_VALUE_DOMAIN_LABELS[d]).join(', ')}</span>. Ask for these as well
              as money; they are often easier to get.
            </p>
            <Link href="/dashboard/what-i-need" className="text-sm text-primary underline underline-offset-4">
              Update what you need
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pay is only part of a good offer. Tell us what you will not trade away and we will remind you to ask for it.{' '}
            <Link href="/dashboard/what-i-need" className="text-primary underline underline-offset-4">
              Take What I Need (about 10 minutes)
            </Link>
          </p>
        )}
      </section>

      {asks.length > 0 && (
        <section className="space-y-3" aria-labelledby="asks">
          <h2 id="asks" className="text-lg font-semibold">
            What you said you want in the package
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {asks.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <Link href="/dashboard/search-strategy" className="text-sm text-primary underline underline-offset-4">
            Update your priorities
          </Link>
        </section>
      )}

      </MoreDetails>
    </div>
  )
}
