import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { effectiveJourney } from '@/lib/journey/journey'
import { currentStartStage, getStartStage, hasStartDetails, missingStartFields, startDetailsOf } from '@/lib/journey/start-business'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { StartEventsTab } from '@/components/dashboard/start/StartEventsTab'
import { StartFundingTab, StartHelpTab, StartPlanTab } from '@/components/dashboard/start/StartTabs'
import { startBuilding } from './actions'

export const metadata: Metadata = { title: 'Start a business' }

const TABS = [
  { key: 'plan', label: 'Your plan' },
  { key: 'help', label: 'Get help' },
  { key: 'funding', label: 'Fund it' },
  { key: 'events', label: 'Events near you' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function StartBusinessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getDashboardProfile()
  const sp = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'plan'
  const details = startDetailsOf(profile.journeyDetails)
  const main = effectiveJourney(profile)
  const started = main === 'ENTREPRENEUR' || hasStartDetails(profile.journeyDetails)
  const stage = currentStartStage(details)
  const jd = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  const venture = typeof jd.venture === 'string' && jd.venture.trim() ? jd.venture.trim().slice(0, 200) : null
  const runwayMonths = typeof jd.runwayMonths === 'number' && Number.isFinite(jd.runwayMonths) ? jd.runwayMonths : null
  const edu = await prisma.educationEntry.findFirst({
    where: { candidateId: profile.id },
    orderBy: [{ isPrimary: 'desc' }, { graduationDate: { sort: 'desc', nulls: 'last' } }],
    select: { schoolName: true },
  })
  after(() => captureServerEvent(profile.id, 'start_business_page_viewed', { tab, stage, started, main, unanswered: missingStartFields(details).length, hasSchool: !!edu }))

  const s = getStartStage(stage)
  return (
    <div className="space-y-8">
      <PageHeader
        title={started && tab === 'plan' ? s.next : 'Start a business'}
        intro={started && tab === 'plan' ? s.goal : 'Five steps from idea to growth, with the free and public help at each one: your school, local advisors, incubators and accelerators, and funding.'}
        action={
          !started ? (
            <form action={startBuilding}>
              <ActionSubmit pendingLabel="Starting…" event="start_business_start_pressed" props={{ main }}>
                Start my plan
              </ActionSubmit>
            </form>
          ) : undefined
        }
      />
      <nav aria-label="Start a business sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'plan' ? '/dashboard/start-a-business' : `/dashboard/start-a-business?tab=${t.key}`}
            aria-current={t.key === tab ? 'page' : undefined}
            className={t.key === tab ? 'inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white' : 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === 'plan' && <StartPlanTab details={details} stage={stage} started={started} schoolName={edu?.schoolName ?? null} venture={venture} runwayMonths={runwayMonths} />}
      {tab === 'help' && <StartHelpTab details={details} stage={stage} />}
      {tab === 'funding' && <StartFundingTab details={details} stage={stage} />}
      {tab === 'events' && <StartEventsTab state={profile.currentState ?? null} />}
    </div>
  )
}
