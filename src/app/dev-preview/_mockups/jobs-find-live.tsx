import type { ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TuneStrip } from '@/components/candidate/TuneStrip'
import { PrimaryButton } from '@/components/candidate/ui'
import { AddJobAction } from '@/components/dashboard/find/AddJobAction'
import { FindTwoPane } from '@/components/dashboard/find/FindTwoPane'
import { boardEntry, surfacedEntry, type FindEntry } from '@/components/dashboard/find/entries'
import { MyJobsRedesign } from '@/components/dashboard/find/MyJobsRedesign'
import type { JobMatch, MatchDimension, MatchDimensionKey, MatchStatus } from '@/lib/jobs/job-match-types'
import type { MyJobItem, MyJobsView } from '@/lib/jobs/my-jobs-data'
import type { JobStatus } from '@/lib/jobs/my-jobs'

// The REAL Find a job and My jobs components, fed sample data, so the redesign can be checked in a browser
// without signing in. The mockups beside this file (jobs-find.tsx, jobs-more.tsx) are the approved look; these
// pages run the code that ships. Dev-only (src/app/dev-preview is never reachable in production).

const NOW = new Date()
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)
const daysAgo = (d: number) => hoursAgo(d * 24)

function posting(p: Partial<ExclusiveJobPosting> & Pick<ExclusiveJobPosting, 'id' | 'title' | 'companyName'>): ExclusiveJobPosting {
  return {
    location: null, url: `https://example.com/jobs/${p.id}`, description: null, addedBy: 'ncrawl', createdAt: hoursAgo(50), postedAt: hoursAgo(50), archivedAt: null,
    level: 'C_SUITE', sourceCategory: 'search_firm', badges: [], postingType: 'recruiter_search', salaryMin: null, salaryMax: null, salaryCurrency: 'USD', payPeriod: 'year',
    status: 'approved', source: 'ats_feed', submittedByEmployerId: null, submittedByRecruiterId: null, disclosure: 'NAMED', companyId: null,
    lastVerifiedAt: hoursAgo(5), directListing: false, targetRemotePolicy: null, marketPayLow: null, marketPayHigh: null, marketPayMid: null, payVsMarket: null,
    marketPayBasis: null, marketPaySample: null, repostCount: 0, reopenCount: 0, repostFirstSeenAt: null, duplicateCount: 0, skills: [], aiSkillItems: [],
    ...p,
  } as unknown as ExclusiveJobPosting
}

const dim = (key: MatchDimensionKey, status: MatchStatus, evidence: string[]): MatchDimension => ({ key, score: null, status, evidence })
const match = (d: Partial<Record<MatchDimensionKey, [MatchStatus, string[]]>>): JobMatch => ({
  overallScore: 80,
  overall: 'good',
  gaps: [],
  requirements: [],
  dimensions: Object.fromEntries(
    (['skills', 'culture', 'salary', 'goals', 'workStyle'] as const).map((k) => [k, dim(k, d[k]?.[0] ?? 'unknown', d[k]?.[1] ?? [])])
  ) as JobMatch['dimensions'],
})

const DESCRIPTION = 'Lead finance for a growing, privately held company. You will own financial planning, reporting and the audit, and partner with the CEO and the board on capital allocation.'

const BOARD: Parameters<typeof boardEntry>[0][] = [
  {
    posting: posting({ id: 'cfo-arsenault', title: 'Chief Financial Officer', companyName: 'Arsenault', location: 'New York, NY', salaryMin: 280000, salaryMax: 340000, marketPayLow: 260000, marketPayHigh: 320000, marketPayMid: 290000, payVsMarket: 'above', marketPayBasis: 'posted salaries', marketPaySample: 38, description: DESCRIPTION, createdAt: hoursAgo(34), postedAt: hoursAgo(34) }),
    fitBucket: 'good',
    why: { fits: ['your level', 'finance', 'near New York'], gap: 'asks for PE-backed experience' },
    competition: { level: 'low', reasons: ['Search-firm listing', 'posted 34h ago'], fewer: ['Search-firm listing', 'posted 34h ago'] },
    match: match({ skills: ['strong', ['You have led finance at a company this size.']], salary: ['strong', ['Posted range is above your target.']], goals: ['strong', ['New York, where you want to work.']], culture: ['gap', ['They ask for PE-backed experience. You have public-company experience.']] }),
    explainGapsEnabled: false,
    watched: false,
    candidatePlus: true,
  },
  {
    posting: posting({ id: 'ed-byrdcliffe', title: 'Executive Director', companyName: 'Byrdcliffe', location: 'Remote', source: 'employer', submittedByEmployerId: 'emp-1', postingType: 'direct', sourceCategory: 'employer', salaryMin: 210000, salaryMax: 250000, description: DESCRIPTION, createdAt: hoursAgo(5), postedAt: hoursAgo(5), targetRemotePolicy: 'remote' }),
    fitBucket: 'strong',
    why: { fits: ['your level', 'nonprofit board work'], gap: null },
    competition: { level: 'medium', reasons: ['Posted 5h ago'] },
    match: match({ skills: ['strong', ['Your nonprofit board work matches what they ask for.']], goals: ['strong', ['Remote, as you prefer.']] }),
    explainGapsEnabled: false,
    watched: false,
    candidatePlus: true,
  },
  {
    posting: posting({ id: 'coo-ice', title: 'Chief Operating Officer', companyName: 'Intercontinental Exchange', location: 'New York, NY', salaryMin: 320000, salaryMax: 400000, description: DESCRIPTION, createdAt: daysAgo(3), postedAt: daysAgo(3), level: 'C_SUITE' }),
    fitBucket: 'stretch',
    why: { fits: ['operations'], gap: 'a bigger company than you have run' },
    competition: { level: 'high', reasons: ['Large employer'] },
    match: match({ skills: ['partial', ['You have run operations, but not at this size yet.']] }),
    explainGapsEnabled: false,
    watched: false,
    candidatePlus: false,
  },
  {
    posting: posting({ id: 'pres-lemaitre', title: 'President', companyName: 'Lemaitre Vascular', location: 'Burlington, MA', salaryMin: 300000, salaryMax: 380000, description: DESCRIPTION, createdAt: daysAgo(5), postedAt: daysAgo(5) }),
    fitBucket: 'good',
    why: { fits: ['your level', 'a P&L in a regulated industry'], gap: null },
    competition: { level: 'medium', reasons: [] },
    match: match({ skills: ['strong', ['You have led a P&L in a regulated industry.']] }),
    explainGapsEnabled: false,
    watched: true,
    candidatePlus: false,
  },
  {
    posting: posting({ id: 'vp-harbor', title: 'VP Operations', companyName: 'Harbor Health', location: 'Hybrid, Boston', description: DESCRIPTION, createdAt: daysAgo(6), postedAt: daysAgo(6), level: 'VP' }),
    fitBucket: 'good',
    why: { fits: ['your function'], gap: 'one industry over' },
    competition: { level: 'medium', reasons: [] },
    match: match({ skills: ['strong', ['Same function and level, one industry over.']] }),
    explainGapsEnabled: false,
    watched: false,
    candidatePlus: false,
  },
]

const SURFACED = {
  id: 'surf-1', title: 'Chief of Staff', companyName: 'Northwind', location: 'Remote', url: 'https://example.com/northwind', description: 'Work with the CEO on strategy and operating rhythm.',
  surfacedAt: hoursAgo(20), reaction: null,
} as unknown as SurfacedJob

function entries(): FindEntry[] {
  return [
    ...BOARD.map((b) => boardEntry(b)),
    surfacedEntry({ job: SURFACED, fitBucket: 'good', worksHereContacts: [{ id: 'c1', name: 'Priya Shah' }], worksHereTotalCount: 3, watched: false }),
  ]
}

export function FindJobsLive() {
  const all = entries()
  return (
    <PreviewShell place="jobs" entry="find" part="jobs" wide>
      <PageHeader title="Find a job" intro="Roles that fit your background. For each one, we tell you why." />
      <TuneStrip
        title="Better jobs for you: tune your search"
        pct={70}
        because="Matching on Executive operations, New York or remote, full-time. Two answers would sharpen it."
        asks={[{ ask: 'Add your tools.', gain: 'About 150 more jobs match.' }, { ask: 'Say if you would relocate.', gain: 'Opens Pittsburgh and Louisville.' }]}
        actionLabel="Answer two questions"
      />
      <FindTwoPane items={all.map((e) => e.item)} details={Object.fromEntries(all.map((e) => [e.item.id, e.detail]))} summary={`${all.length} jobs, best fit first`} />
    </PreviewShell>
  )
}

function item(i: Partial<MyJobItem> & Pick<MyJobItem, 'key' | 'title' | 'companyName' | 'status' | 'date'>): MyJobItem {
  const sourceId = i.key
  return {
    trackedJobId: i.key, jobPostingId: i.status === 'saved' ? null : `app-${i.key}`, url: `https://example.com/${i.key}`, workType: 'full_time', origin: 'board', appliedVia: null, nextStep: '',
    ref: { source: 'job_board', sourceId, title: i.title, companyName: i.companyName, url: `https://example.com/${i.key}`, workType: 'full_time' }, listing: null, ...i,
  } as MyJobItem
}

const MINE: MyJobsView = {
  items: [
    item({ key: 'offer-1', title: 'Chief of Staff', companyName: 'Northwind', status: 'offer' as JobStatus, date: daysAgo(1) }),
    item({ key: 'int-1', title: 'VP Operations (advisory)', companyName: 'Lattice Labs', status: 'interviewing', date: daysAgo(2) }),
    item({ key: 'app-1', title: 'Head of Delivery', companyName: 'Harbor Health', status: 'applied', date: daysAgo(1) }),
    item({ key: 'app-2', title: 'Director of Operations', companyName: 'Northwind', status: 'applied', date: daysAgo(9) }),
    item({ key: 'app-3', title: 'COO', companyName: 'Brightline', status: 'applied', date: daysAgo(15), origin: 'email', ref: null, url: null }),
    item({ key: 'sav-1', title: 'President', companyName: 'Lemaitre Vascular', status: 'saved', date: daysAgo(3) }),
    item({
      key: 'sav-2', title: 'Executive Director', companyName: 'Byrdcliffe', status: 'saved', date: daysAgo(12),
      listing: { status: 'closed', badge: 'Closed', sentence: 'This job closed on Oct 10. The employer is no longer taking applications.', closedAt: daysAgo(9) },
    }),
    item({ key: 'cls-1', title: 'SVP Finance', companyName: 'Orion', status: 'closed', date: daysAgo(20) }),
  ],
  prompts: [],
  funnel: { clicked: 14, applied: 5, interviewing: 2, offer: 1 },
  insight: null,
  cardStates: new Map(),
  watchedCompanies: new Set(),
}

export function MyJobsLive() {
  return (
    <PreviewShell place="jobs" entry="mine">
      <PageHeader title="My jobs" intro="Every job you have saved or applied to, with the next step for each." action={<AddJobAction atCap={false} />} />
      <MyJobsRedesign view={MINE} now={NOW} />
    </PreviewShell>
  )
}

export function MyJobsEmptyLive() {
  return (
    <PreviewShell place="jobs" entry="mine">
      <PageHeader title="My jobs" intro="Every job you have saved or applied to, with the next step for each." action={<PrimaryButton>Add a job</PrimaryButton>} />
      <MyJobsRedesign view={{ ...MINE, items: [], funnel: { clicked: 0, applied: 0, interviewing: 0, offer: 0 } }} now={NOW} />
    </PreviewShell>
  )
}
