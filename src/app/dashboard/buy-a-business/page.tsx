import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { hasSideDetails } from '@/lib/journey/paths'
import { getParallelPaths } from '@/lib/job-reviews/data'
import { buyDetailsOf, buyHeadline, buyStageForJourneyStage, hasBuyDetails, missingBuyFields, type BuyStageKey } from '@/lib/journey/buy-business'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { FindTab, FinancingTab, PlanTab, TrainingTab } from '@/components/dashboard/buy/BuyTabs'
import { startBuying } from './actions'

export const metadata: Metadata = { title: 'Buy a business' }

const TABS = [
  { key: 'plan', label: 'Your plan' },
  { key: 'find', label: 'Find businesses' },
  { key: 'financing', label: 'Pay for it' },
  { key: 'training', label: 'Learn' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function BuyBusinessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getDashboardProfile()
  const sp = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'plan'
  const details = buyDetailsOf(profile.journeyDetails)
  const main = effectiveJourney(profile) === 'BUY_BUSINESS'
  const started = main || hasBuyDetails(profile.journeyDetails)
  const stage: BuyStageKey = details.stage ?? (main ? buyStageForJourneyStage(effectiveStage(profile)) : 'decide')
  const gaps = missingBuyFields(details)
  const kinds = await getParallelPaths(profile.id)
  const hasSide = hasSideDetails(profile.journeyDetails) || (kinds ?? []).length > 0

  after(() =>
    captureServerEvent(profile.id, 'buy_business_page_viewed', {
      tab,
      stage,
      started,
      mainJourney: main,
      unanswered: gaps.length,
      hasCash: !!details.cash,
      hasIndustries: !!details.industries?.length,
    }),
  )

  const head = buyHeadline(stage, details)
  const planHead = started && tab === 'plan'
  return (
    <div className="space-y-8">
      <PageHeader
        title={planHead ? head.title : 'Buy a business'}
        intro={planHead ? head.because : 'Find a small business that fits your skills and your money, finance it, and run it well. Marketplaces, lenders and training in one place.'}
        action={!started ? <StartForm /> : undefined}
      />
      <nav aria-label="Buy a business sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'plan' ? '/dashboard/buy-a-business' : `/dashboard/buy-a-business?tab=${t.key}`}
            aria-current={t.key === tab ? 'page' : undefined}
            className={
              t.key === tab
                ? 'inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white'
                : 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'plan' && <PlanTab details={details} stage={stage} started={started} main={main} gapsCount={gaps.length} hasSide={hasSide} />}
      {tab === 'find' && <FindTab details={details} stage={stage} />}
      {tab === 'financing' && <FinancingTab details={details} stage={stage} />}
      {tab === 'training' && <TrainingTab stage={stage} />}
    </div>
  )
}

function StartForm() {
  return (
    <form action={startBuying} className="flex flex-wrap items-center gap-3">
      <ActionSubmit pendingLabel="Starting…" event="buy_business_start_pressed" props={{ as: 'alongside' }}>
        Start my buying plan
      </ActionSubmit>
    </form>
  )
}
