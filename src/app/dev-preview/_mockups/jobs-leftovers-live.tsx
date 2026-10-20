import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { SectionBlock } from '@/components/candidate/Blocks'
import { AdzunaMarketRedesign } from '@/components/market/AdzunaMarketRedesign'
import { CompanyHiringIndexView } from '@/components/companies/CompanyHiringIndex'
import { CompanyIntelPanelsView } from '@/components/companies/CompanyIntelPanelsView'
import { CompanyHowToRedesign } from '@/components/companies/CompanyHowToRedesign'
import { CultureProfileBars, CultureSurveyOwnEntry } from '@/components/companies/CultureSurvey'
import { ReviewSummaryPanel } from '@/components/companies/ReviewSummaryPanel'
import { InterviewPrepTabs } from '@/components/dashboard/interview-prep/InterviewPrepTabs'
import { InWorkWorkspace, type InWorkTab } from '@/components/in-work/InWorkWorkspace'
import { ConversationForm, EMPTY_DRAFT } from '@/components/dashboard/ConversationForm'
import { HireOutcomeForm, AgeBandForm, LastJobEndedForm } from '@/components/dashboard/HireOutcomeForm'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import type { CompanyHiringIndex } from '@/lib/companies/hiring-index-data'
import type { CompanyIntelPanels } from '@/lib/companies/company-intel-data'
import type { CultureProfile } from '@/lib/companies/culture-aggregate'
import type { ReviewSummary } from '@/lib/job-reviews/aggregate'
import type { WorkspaceData } from '@/lib/in-work/workspace-data'

// Sample-data fixtures for the redesigned content that sits behind a click (docs/redesign-old-card-audit-jobs.md).
// They render the real components. Dev-only: src/app/dev-preview is never reachable in production.

const NOW = new Date()
const iso = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
const dateOnly = (days: number) => iso(days).slice(0, 10)

// ---- The advertised-pay chart on Know your worth ------------------------------------------------------------------

export const PAY_CHART_SAMPLE = (
  <AdzunaMarketRedesign
    role="Director of Operations"
    placeLabel="Massachusetts"
    stateName="Massachusetts"
    stateScoped
    targetCompMin={190000}
    demand={{ count: 412, meanSalary: 184000 }}
    histogram={{
      buckets: [
        { min: 100000, count: 38 },
        { min: 120000, count: 91 },
        { min: 140000, count: 142 },
        { min: 160000, count: 118 },
        { min: 180000, count: 64 },
        { min: 200000, count: 27 },
      ],
      total: 480,
    }}
    history={{
      points: [
        { month: '2026-05', averageSalary: 171000 },
        { month: '2026-06', averageSalary: 173500 },
        { month: '2026-07', averageSalary: 172000 },
        { month: '2026-08', averageSalary: 176000 },
        { month: '2026-09', averageSalary: 178500 },
        { month: '2026-10', averageSalary: 181000 },
      ],
    }}
    top={{
      companies: [
        { name: 'Harbor Health', count: 14 },
        { name: 'Northwind', count: 11 },
        { name: 'Lattice Labs', count: 7 },
      ],
    }}
    geo={{
      states: [
        { state: 'California', count: 1210 },
        { state: 'Texas', count: 830 },
        { state: 'New York', count: 790 },
        { state: 'Massachusetts', count: 412 },
        { state: 'Illinois', count: 380 },
      ],
    }}
  />
)

export function PayChartLive() {
  return (
    <PreviewShell place="jobs" entry="market" part="pay">
      <div className="space-y-8">
        <PageHeader title="Know your worth" intro="What roles like yours pay, so you can aim well and ask with facts. Private to you." />
        <SectionBlock id="market" title="The market for your role">
          {PAY_CHART_SAMPLE}
        </SectionBlock>
      </div>
    </PreviewShell>
  )
}

// ---- Company profile: hiring history, culture, how to get hired --------------------------------------------------

const HIRING: CompanyHiringIndex = {
  profile: {
    industry: 'Healthcare',
    siteType: 'multi_site',
    states: ['MA', 'NH', 'RI'],
    topLocations: [{ location: 'Boston, MA', count: 9 }],
    remoteShare: 0.2,
    topFunctions: [
      { function: 'Operations', count: 6 },
      { function: 'Finance', count: 3 },
    ],
    levelMix: [
      { group: 'director', count: 4 },
      { group: 'manager', count: 5 },
    ],
    directorPlusShare: 0.4,
    vpPlusShare: 0.1,
    openNow: 9,
    opened90d: 5,
    opened12mo: 17,
    totalSeen: 31,
    firstSeenAt: iso(300),
    warnFilings12mo: 0,
    warnEmployees12mo: 0,
    lastWarnAt: null,
    layoffNews12mo: 0,
    payLevel: 'high',
    payLevelSample: 12,
    payLevelRatio: 1.14,
    postedPayShare: 0.6,
    computedAt: iso(1),
  },
  open: [
    { id: 'o1', title: 'Director of Clinical Operations', location: 'Boston, MA', url: '#', openedAt: iso(12), closedAt: null, seniorityGroup: 'director', function: 'Operations', payMin: 190000, payMax: 230000, marketLow: 165000, marketMid: 185000, marketHigh: 205000, marketBasis: 'function_state', marketSample: 40, payVsMarket: 'above', closedLabel: null, repostLine: null },
    { id: 'o2', title: 'Manager, Revenue Cycle', location: 'Remote', url: '#', openedAt: iso(30), closedAt: null, seniorityGroup: 'manager', function: 'Finance', payMin: null, payMax: null, marketLow: 110000, marketMid: 125000, marketHigh: 140000, marketBasis: 'function_state', marketSample: 22, payVsMarket: null, closedLabel: null, repostLine: null },
    { id: 'o3', title: 'Vice President, Network Strategy', location: 'Boston, MA', url: '#', openedAt: iso(55), closedAt: null, seniorityGroup: 'vp', function: 'Strategy', payMin: null, payMax: null, marketLow: null, marketMid: null, marketHigh: null, marketBasis: null, marketSample: null, payVsMarket: null, closedLabel: null, repostLine: null },
  ],
  past: [
    { id: 'p1', title: 'Director of Patient Access', location: 'Worcester, MA', url: '#', openedAt: iso(200), closedAt: iso(120), seniorityGroup: 'director', function: 'Operations', payMin: 160000, payMax: 180000, marketLow: 150000, marketMid: 168000, marketHigh: 186000, marketBasis: 'function_state', marketSample: 31, payVsMarket: 'in_line', closedLabel: 'Closed', repostLine: null },
  ],
  openTotal: 3,
  pastTotal: 1,
  lifecycle: { open: 9, closed: 14, expired: 8, medianDaysOpen: 46, repostedRoles: 2, reposts: 3 },
}

const INTEL: CompanyIntelPanels = {
  pay: [
    { level: 'Director', function: 'Operations', postings: 3, medianMin: 185000, medianMax: 225000, lowest: 170000, highest: 240000 },
    { level: 'Manager', function: 'Finance', postings: 1, medianMin: 120000, medianMax: 140000, lowest: 120000, highest: 140000 },
  ],
  visaWages: [{ socTitle: 'Medical and health services managers', filings: 31, p25: 168000, median: 189000, p75: 214000, state: 'MA', latest: NOW }],
  filings: [],
  federal: null,
  companyName: 'Harbor Health',
  payPostings: 4,
  layoffs: {
    status: 'hiring_again',
    totalEmployees: 120,
    events: [{ noticeDate: new Date(NOW.getTime() - 200 * 86_400_000), employees: 120, layoffType: 'layoff', sourceUrl: '#', postedSince: 14, topFunctionsSince: ['Operations', 'Finance'] }],
  },
  apply: { ats: { info: { name: 'Workday', tips: ['Create one account and reuse it for every role.', 'Paste your résumé text into the fields as well as uploading it.'] }, postings: 7, of: 9 }, medianDaysOpen: 46, backing: null, recruiterLedSearches: 2 },
  openPostings: 9,
} as unknown as CompanyIntelPanels

const CULTURE: CultureProfile = {
  companyId: 'c1',
  respondentCount: 7,
  shown: true,
  dimensions: [
    { key: 'pace', answered: 7, shares: [14, 57, 29], mean: 2.1, typical: 2 },
    { key: 'workLife', answered: 7, shares: [29, 57, 14], mean: 1.9, typical: 2 },
    { key: 'growth', answered: 6, shares: [0, 33, 67], mean: 2.7, typical: 3 },
  ],
} as unknown as CultureProfile

const REVIEWS: ReviewSummary = {
  companyId: 'c1',
  respondentCount: 6,
  shown: true,
  rating: { average: 4.1, count: 6 },
  recommend: [
    { value: 'yes', label: 'Yes', percent: 67 },
    { value: 'maybe', label: 'Maybe', percent: 33 },
  ],
  hiredVia: [
    { value: 'referral', label: 'Referral', percent: 50 },
    { value: 'applied', label: 'Applied directly', percent: 50 },
  ],
  workerType: [{ value: 'w2', label: 'Employee', percent: 100 }],
  liked: [
    { value: 'mission', label: 'The mission', percent: 83 },
    { value: 'team', label: 'My team', percent: 50 },
  ],
  disliked: [{ value: 'process', label: 'Slow decisions', percent: 67 }],
}

export function CompanySectionsLive() {
  return (
    <PreviewShell place="jobs" entry="companies">
      <div className="space-y-10">
        <PageHeader title="Harbor Health" />
        <CompanyHiringIndexView companyId="c1" viewer="candidate" data={HIRING} redesign />
        <CompanyIntelPanelsView d={INTEL} redesign />
        <SectionBlock id="culture-h" title="What people who worked here say" why="Combined answers from members who worked here. Nobody's answers are shown on their own.">
          <div className="space-y-6">
            <CultureProfileBars profile={CULTURE} redesign />
            <CultureSurveyOwnEntry companyId="c1" companyName="Harbor Health" companySlug="harbor-health" initial={null} isCurrent={false} redesign />
            <div className="space-y-2">
              <h3 className="font-display text-lg font-semibold text-ink">Ratings and reviews</h3>
              <ReviewSummaryPanel summary={REVIEWS} canReview redesign />
            </div>
          </div>
        </SectionBlock>
        <CompanyHowToRedesign
          companyId="c1"
          slug="harbor-health"
          intel={[
            { id: 'i1', intelType: 'interview_loop', body: 'Four rounds: a recruiter screen, the hiring manager, a panel, then a case study presentation to the executive team.', roleLevelAtTime: 'Director', recencyBucket: 'within_2yrs', helpfulCount: 5 },
            { id: 'i2', intelType: 'what_they_test', body: 'Heavy focus on stakeholder management scenarios, less on technical depth.', roleLevelAtTime: null, recencyBucket: '2_5yrs', helpfulCount: 2 },
          ]}
        />
      </div>
    </PreviewShell>
  )
}

export function CompanyCultureEmptyLive() {
  return (
    <PreviewShell place="jobs" entry="companies">
      <div className="space-y-10">
        <CompanyHiringIndexView companyId="c1" viewer="candidate" data={{ ...HIRING, profile: null, open: [], past: [], openTotal: 0, pastTotal: 0, lifecycle: null }} redesign />
        <SectionBlock id="culture-h" title="What people who worked here say" why="Combined answers from members who worked here. Nobody's answers are shown on their own.">
          <div className="space-y-6">
            <CultureProfileBars profile={{ ...CULTURE, shown: false, respondentCount: 1, dimensions: [] }} redesign />
            <ReviewSummaryPanel summary={{ ...REVIEWS, shown: false, respondentCount: 1 }} canReview={false} redesign />
          </div>
        </SectionBlock>
        <CompanyHowToRedesign companyId="c1" slug="harbor-health" intel={[]} />
      </div>
    </PreviewShell>
  )
}

// ---- Interview tabs 2 to 5 ----------------------------------------------------------------------------------------

export function InterviewTabsLive() {
  return (
    <PreviewShell place="jobs" entry="interviews">
      <div className="space-y-8">
        <PageHeader title="Interviews" intro="Get ready for the next one, and practice the questions that decide offers." />
        <section id="practice" aria-label="Practice">
          <InterviewPrepTabs
            coreStatement="I turn complicated operations into things that run on time."
            adaptations={null}
            targetRoleType="Chief Operating Officer"
            storyComfort={50}
            interviewComfort={25}
            elevatorPitchReady={75}
            hasJobDescription
            jobHoppingFlag
            redesign
          />
        </section>
      </div>
    </PreviewShell>
  )
}

// ---- In-work tab bodies ---------------------------------------------------------------------------------------------

const cycle = (key: string, label: string, days: number) => ({
  key,
  label,
  windowStart: dateOnly(-days),
  windowEnd: dateOnly(-days - 30),
  prepareOn: dateOnly(-days + 21),
  respondOn: dateOnly(-days - 3),
  daysToWindow: days,
  exact: false,
})

const WORKSPACE: WorkspaceData = {
  inWorkJourney: true,
  journeyLabel: 'Growing in my job',
  settings: { cadence: 'SEMI_ANNUAL', anchorMonth: 2, nextReviewDate: null, promptsEnabled: true },
  nextCycle: cycle('2027-02', 'February 2027', 100),
  lastCycle: cycle('2026-08', 'August 2026', -60),
  wins: [
    { id: 'w1', what: 'Rebuilt the onboarding flow for new customers', result: 'Cut setup time from 9 days to 3, and 40 accounts went live a month earlier', whoBenefited: 'Customer success team', occurredOn: dateOnly(20) },
    { id: 'w2', what: 'Mentored two new managers', result: 'Both were promoted within a year', whoBenefited: null, occurredOn: dateOnly(75) },
  ],
  summarySince: dateOnly(60),
  prep: { cycleKey: '2027-02', checklist: { wins: true }, wins: '', goals: '', theAsk: '', evidence: '', managerQuestions: [], completedAt: null },
  prepCycleKey: '2027-02',
  carry: { recap: 'Last review: exceeds expectations, 4% raise.', openFollowUps: ['Agree a promotion timeline with my manager'], lastGoals: 'Own the Q1 launch end to end' },
  plan: {
    targetLevel: 'Senior manager',
    gapItems: [
      { id: 'g1', text: 'Lead a cross-team project', done: true },
      { id: 'g2', text: 'Present to the executive team', done: false },
    ],
    stretchScope: 'Own the regional launch budget',
    stretchDecider: 'Dana Whitfield',
    plan30: 'Learn the current state',
    plan60: 'Deliver the first change',
    plan90: 'Report results',
    visibilityItems: [{ id: 'v1', text: 'Send a monthly update to my skip-level', done: false }],
  },
  feedback: [
    {
      id: 'f1',
      source: 'MANAGER',
      category: 'GROWTH_AREA',
      receivedOn: dateOnly(14),
      whatWasSaid: 'You do great work, but I would like to hear about it earlier, before it is finished.',
      actionItems: [{ id: 'a1', text: 'Send a written update every Friday', done: false, sprintAddedAt: null }],
    },
  ],
  outcomes: [
    {
      id: 'o1',
      cycleKey: '2026-08',
      reviewedOn: dateOnly(60),
      rating: 'Exceeds expectations',
      raiseReceived: true,
      raisePercent: 4,
      promoted: false,
      newTitle: null,
      notes: 'Wants me to take on more visible work next cycle.',
      followUps: [{ id: 'u1', text: 'Agree a promotion timeline with my manager', done: false }],
    },
  ],
} as unknown as WorkspaceData

export function InWorkLive({ tab }: { tab: InWorkTab }) {
  return (
    <PreviewShell place="jobs" entry="offers">
      <InWorkWorkspace data={WORKSPACE} initialTab={tab} redesign />
    </PreviewShell>
  )
}

// ---- Form field styling ---------------------------------------------------------------------------------------------

export function FormsLive() {
  return (
    <PreviewShell place="jobs" entry="offers">
      <div className="space-y-12">
        <SectionBlock id="settle-h" title="Settle three things before you walk in" why="Write them down once. Everything you save here is private to you.">
          <ConversationForm draft={EMPTY_DRAFT} suggestions={['Cut setup time from 9 days to 3', 'Mentored two managers to promotion']} redesign />
        </SectionBlock>
        <SectionBlock id="how-h" title="Tell us how it came together" why="This helps us show what works for people at your stage. It is separate from the Offer Bonus and needs no offer letter.">
          <HireOutcomeForm redesign />
        </SectionBlock>
        <SectionBlock id="stage-h" title="Where you are in your search" why="Add your last day worked so we compare you with people at the same stage, not with everyone.">
          <LastJobEndedForm current={null} redesign />
          <AgeBandForm current={null} redesign />
        </SectionBlock>
        <ResumeUploadForm narratives={[{ id: 'n1', label: 'Operations leader' }]} resumeBookOptIn redesign />
      </div>
    </PreviewShell>
  )
}
