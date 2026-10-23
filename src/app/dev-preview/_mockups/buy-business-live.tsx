import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { FindTab, FinancingTab, PlanTab, TrainingTab } from '@/components/dashboard/buy/BuyTabs'
import { buyHeadline, type BuyDetails } from '@/lib/journey/buy-business'

// The Buy a business page as built (src/app/dashboard/buy-a-business/page.tsx), fed sample data.

const SAMPLE: BuyDetails = {
  stage: 'prepare',
  skills: ['operations', 'people', 'finance'],
  industries: ['home_services', 'b2b_services'],
  size: '300_500',
  cash: '100_250',
  financing: ['sba', 'seller'],
  why: 'hiring',
  ready: ['hours', 'people'],
}

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <div className="space-y-8">
        <PageHeader title={title} intro={intro} />
        {children}
      </div>
    </PreviewShell>
  )
}

const INTRO = 'Find a small business that fits your skills and your money, finance it, and run it well. Marketplaces, lenders and training in one place.'

export function BuyPlanLive() {
  const h = buyHeadline('prepare', SAMPLE)
  return (
    <Shell title={h.title} intro={h.because}>
      <PlanTab details={SAMPLE} stage="prepare" started main={false} gapsCount={4} />
    </Shell>
  )
}

export function BuyPlanNewLive() {
  return (
    <Shell title="Buy a business" intro={INTRO}>
      <PlanTab details={{}} stage="decide" started={false} main={false} gapsCount={9} />
    </Shell>
  )
}

export function BuyFindLive() {
  return (
    <Shell title="Buy a business" intro={INTRO}>
      <FindTab details={SAMPLE} stage="search" />
    </Shell>
  )
}

export function BuyFinancingLive() {
  return (
    <Shell title="Buy a business" intro={INTRO}>
      <FinancingTab details={SAMPLE} stage="prepare" />
    </Shell>
  )
}

export function BuyTrainingLive() {
  return (
    <Shell title="Buy a business" intro={INTRO}>
      <TrainingTab stage="prepare" />
    </Shell>
  )
}
