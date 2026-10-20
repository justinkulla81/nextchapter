import type { InterimListing, InterimSignupSource } from '@prisma/client'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { FindUnposted } from '@/components/dashboard/find/FindUnposted'
import { FindIndependent } from '@/components/dashboard/find/FindIndependent'
import { FindResources } from '@/components/dashboard/find/FindResources'
import { FindPartMessage } from '@/components/dashboard/find/FindPartMessage'
import { buildUnpostedItems, groupContactsByCompany, type OpeningInput } from '@/lib/jobs/find-unposted'
import { labelBoards } from '@/lib/jobs/find-resources'
import { FIND_PART_HEADER } from '@/lib/jobs/find-part-copy'
import { GENERAL_JOB_BOARDS, getIndustryJobBoards } from '@/lib/constants/industry-job-boards'
import { GUIDES } from '@/lib/constants/guides'
import type { IndependentWorkData } from '@/lib/interim-work/independent-work-data'
import type { PlatformActivityRow, PlatformStatus } from '@/lib/platforms/candidate-view'

// The REAL Not posted yet, Independent work and Resources parts of Find a job, fed sample data, so the redesign can be
// checked in a browser without signing in. The mockups beside this file (jobs-more.tsx) are the approved look; these
// pages run the code that ships. Dev-only (src/app/dev-preview is never reachable in production).

const NOW = new Date()
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

// ---------- Not posted yet ----------

const OPENINGS: OpeningInput[] = [
  { id: 'o1', companyName: 'Lemaitre Vascular', signalType: 'EXEC_DEPARTURE', summary: 'The President retires December 31 and no successor is named.', filingDate: daysAgo(8), filingUrl: 'https://www.sec.gov/Archives/example-1', source: 'sec', reason: 'Fits your operations background', companyRelation: null },
  { id: 'o2', companyName: 'ManpowerGroup', signalType: 'EXEC_APPOINTMENT', summary: 'The President was promoted to CEO. A search for a replacement often follows.', filingDate: daysAgo(12), filingUrl: 'https://www.sec.gov/Archives/example-2', source: 'sec', reason: 'Fits your operations background', companyRelation: null },
  { id: 'o3', companyName: 'Whatnot', signalType: 'FUNDING_RAISE', summary: 'Raised $547M. Fresh funding often comes with senior hires in the next few months.', filingDate: daysAgo(15), filingUrl: 'https://news.example.com/whatnot', source: 'news', reason: 'You applied here', companyRelation: 'applied' },
  { id: 'o4', companyName: 'CSX', signalType: 'EXEC_DEPARTURE', summary: 'The Chief Operating Officer retired October 12. No successor named.', filingDate: daysAgo(20), filingUrl: 'https://www.sec.gov/Archives/example-4', source: 'sec', reason: 'On your company list', companyRelation: 'watched' },
  { id: 'o5', companyName: 'Harbor Health', signalType: 'FUNDING_RAISE', summary: 'Raised $80M to open 12 clinics.', filingDate: daysAgo(25), filingUrl: 'https://www.sec.gov/Archives/example-5', source: 'sec', reason: null, companyRelation: null },
  { id: 'o6', companyName: 'Northwind Traders', signalType: 'EXEC_APPOINTMENT', summary: 'A new CEO started this month.', filingDate: daysAgo(27), filingUrl: 'https://news.example.com/northwind', source: 'news', reason: null, companyRelation: null },
]

const CONTACTS = groupContactsByCompany([
  { id: 'c1', name: 'Priya Shah', title: 'VP Operations', company: 'Lemaitre Vascular', inferredCompany: null },
  { id: 'c2', name: 'Marcus Lee', title: 'Director', company: 'ManpowerGroup Inc.', inferredCompany: null },
])

export function FindUnpostedLive() {
  const head = FIND_PART_HEADER.unposted
  return (
    <PreviewShell place="jobs" entry="find" part="unposted">
      <PageHeader title={head.title} intro={head.intro} />
      <FindUnposted items={buildUnpostedItems(OPENINGS, CONTACTS)} fullTime includeFullTimeHref="#" />
    </PreviewShell>
  )
}

export function FindUnpostedEmptyLive() {
  const head = FIND_PART_HEADER.unposted
  return (
    <PreviewShell place="jobs" entry="find" part="unposted">
      <PageHeader title={head.title} intro={head.intro} />
      <FindUnposted items={[]} fullTime includeFullTimeHref="#" />
    </PreviewShell>
  )
}

export function FindUnpostedErrorLive() {
  const head = FIND_PART_HEADER.unposted
  return (
    <PreviewShell place="jobs" entry="find" part="unposted">
      <PageHeader title={head.title} intro={head.intro} />
      <FindPartMessage tone="error" title="We could not load these openings">
        <p>Nothing you saved is lost. Try again in a moment.</p>
      </FindPartMessage>
    </PreviewShell>
  )
}

// ---------- Independent work ----------

function listing(id: string, name: string, category: InterimListing['category'], description: string, designation: InterimListing['designation'] = 'INCLUDED_FOR_QUALITY'): InterimListing {
  return { id, name, category, description, url: `https://example.com/${id}`, logoUrl: null, designation, audienceFocus: 'GENERAL', designationNote: null, isActive: true, sortOrder: 0, createdAt: NOW, updatedAt: NOW }
}

const MARKET = [
  listing('l1', 'Business Talent Group', 'MARKETPLACE_GENERAL', 'Matches independent executives to consulting projects.', 'PARTNER'),
  listing('l2', 'Catalant', 'MARKETPLACE_GENERAL', 'On-demand experts for strategy and operations projects.'),
  listing('l3', 'Mercor', 'MARKETPLACE_TECHNICAL', 'Contract work for technical and AI-adjacent specialists.'),
]
const EXPERT = [listing('l4', 'Third Bridge', 'EXPERT_NETWORK', 'Paid calls with investors and consultants.'), listing('l5', 'AlphaSights', 'EXPERT_NETWORK', 'One-hour advisory calls for clients across industries.')]
const BOARD = [listing('l6', 'BoardProspects', 'BOARD_ADVISORY', 'A directory of board and advisory searches.')]

const row = (name: string, key: string, label: string, tone: PlatformActivityRow['tone'], healthLabel: string | null = null): PlatformActivityRow => ({
  platformKey: key, name, category: 'Fractional marketplace', kind: 'WORK', stage: 'ACCEPTED', stageAt: daysAgo(9), lastEmailAt: daysAgo(3), lastSubject: 'Welcome', courseTitle: null, dismissed: false, label, tone, healthLabel,
})

function phases(done: number[]): IndependentWorkData['phases'] {
  const defs: [string, string, { label: string; href: string } | null][] = [
    ['Unlock the Interim/Gig Directory', 'Fractional and interim rates typically land below a full-time equivalent once you annualize the hours, so set a target before you browse.', null],
    ['Define your offer', 'One or two sentences on the specific expertise you are selling, and at what level.', null],
    ['Package your proof', 'A work sample is the fastest way to make your offer concrete instead of abstract.', { label: 'Add a work sample', href: '#' }],
    ['Get positioned publicly', 'A profile that reads as available for interim work is what makes inbound possible.', { label: 'Update your LinkedIn', href: '#' }],
    ['Activate your network', 'Most interim work comes through a warm introduction, not a marketplace application.', { label: 'Log an outreach', href: '#' }],
    ['Browse and reach out', 'Pick two or three platforms that fit your offer and create a profile on each.', null],
  ]
  return defs.map(([title, description, cta], i) => ({ number: i + 1, title, description, completed: done.includes(i + 1), cta }))
}

const STATUS = new Map<string, PlatformStatus>([['l1', { label: 'Accepted', tone: 'done', healthLabel: null }]])

function data(over: Partial<IndependentWorkData> = {}): IndependentWorkData {
  return {
    showIndependent: true,
    showAdvisory: true,
    boardReady: true,
    phases: phases([1, 2]),
    marketplaceListings: MARKET,
    expertNetworkListings: EXPERT,
    allBoardListings: BOARD,
    boardListings: BOARD,
    signedUpIds: new Map<string, InterimSignupSource>([['l1', 'SELF_REPORTED' as InterimSignupSource], ['l4', 'SELF_REPORTED' as InterimSignupSource]]),
    interimSignups: [
      { listing: { name: 'Business Talent Group', category: 'MARKETPLACE_GENERAL' } },
      { listing: { name: 'Third Bridge', category: 'EXPERT_NETWORK' } },
    ],
    interimSignupMix: { hasMarketplaceSignup: true, hasExpertNetworkSignup: true, hasBoardSignup: false, satisfied: false },
    isMember: true,
    platformRows: [row('Business Talent Group', 'btg', 'Accepted', 'done'), row('micro1', 'micro1', 'In vetting', 'progress')],
    platformStatuses: STATUS,
    gmailConnected: true,
    clickedNotRegistered: [],
    hasWomenFocusedListings: false,
    ...over,
  } as IndependentWorkData
}

function IndependentPage({ view, unlocked = true }: { view: IndependentWorkData; unlocked?: boolean }) {
  const head = FIND_PART_HEADER.independent
  return (
    <PreviewShell place="jobs" entry="find" part="independent">
      <PageHeader title={head.title} intro={head.intro} />
      <FindIndependent data={view} unlocked={unlocked} boardAdvisoryWillingness={null} boardDiversityOptIn={null} workHistory={[]} />
    </PreviewShell>
  )
}

export function FindIndependentLive() {
  return <IndependentPage view={data()} />
}

/** A member who has not set a rate target: the first step is the form, and the directories wait for it. */
export function FindIndependentNewLive() {
  return <IndependentPage view={data({ phases: phases([]), interimSignups: [], platformRows: [], signedUpIds: new Map(), isMember: false })} unlocked={false} />
}

/** Offer not defined yet: the second step shows its own form. */
export function FindIndependentOfferLive() {
  return <IndependentPage view={data({ phases: phases([1]), interimSignups: [], platformRows: [], signedUpIds: new Map() })} />
}

// ---------- Resources ----------

export function FindResourcesLive({ optedIn = false }: { optedIn?: boolean }) {
  const head = FIND_PART_HEADER.resources
  const industries = ['Healthcare', 'Technology']
  return (
    <PreviewShell place="jobs" entry="find" part="resources">
      <PageHeader title={head.title} intro={head.intro} />
      <FindResources
        boards={labelBoards(GENERAL_JOB_BOARDS, getIndustryJobBoards(industries))}
        resumeOptedIn={optedIn}
        recruiter={{ confirmed: true, optedIn: true }}
        guides={GUIDES.filter((g) => g.pageSlot === 'find-my-job').slice(0, 2)}
      />
    </PreviewShell>
  )
}

export function FindResourcesOptedInLive() {
  return <FindResourcesLive optedIn />
}
