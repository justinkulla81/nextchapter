import type { ResumeFixItem } from '@/lib/reports/market-reality-sections'
import type { AddressableMarket } from '@/lib/profile/addressable-market'
import type { Strengths } from '@/lib/profile/strengths-load'
import type { AreaBrief } from '@/lib/workforce/area-brief-data'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { VerdictPanel } from '@/components/candidate/Blocks'
import { CompaniesRedesign, type RedesignCompanyRow } from '@/components/companies/CompaniesRedesign'
import { AiPayPremiumCard } from '@/components/companies/AiPayPremiumCard'
import { MarketRedesign } from '@/components/market/MarketRedesign'
import { PayRedesign } from '@/components/market/PayRedesign'
import { OfferedWagesView } from '@/components/market/OfferedWagesSection'
import { ResumeRedesign } from '@/components/dashboard/ResumeRedesign'
import type { ResumeVersionItem } from '@/components/dashboard/ResumeVersionsList'
import { StrengthsRedesign, WhyHireView } from '@/components/dashboard/StrengthsRedesign'
import { AreaBriefView } from '@/components/workforce/AreaBriefView'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { JobDescriptionCard } from '@/components/dashboard/interview-prep/JobDescriptionCard'
import { InterviewPrepTabs } from '@/components/dashboard/interview-prep/InterviewPrepTabs'
import { payPositionText } from '@/lib/redesign/jobs-pages'

// The REAL redesigned Jobs pages (Companies, Your market, Know your worth, Résumé, Why hire me, Local market, Interviews),
// fed sample data, so they can be screenshotted and reviewed without signing in. Dev-only: src/app/dev-preview is never
// reachable in production. The page files in src/app/dashboard load the real data and render these same components.

const NOW = new Date()
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

// ---- Companies -------------------------------------------------------------------------------------------------

const COMPANY_ROWS: RedesignCompanyRow[] = [
  { id: 'c1', name: 'Harbor Health', canonicalNameNormalized: 'harbor-health', industry: 'Healthcare', hqMetro: 'Boston', openRoles: 4, contacts: 2, rank: 1, band: 'strong', ranking: { reasons: ['Hiring four operations leaders, which is your field.'], cautions: [] } },
  { id: 'c2', name: 'Northwind', canonicalNameNormalized: 'northwind', industry: 'Logistics software', hqMetro: 'Cambridge', openRoles: 3, contacts: 0, rank: 2, band: 'strong', ranking: { reasons: ['You applied here, and two alumni work there.'], cautions: ['Filed a layoff notice last month.'] } },
  { id: 'c3', name: 'Lattice Labs', canonicalNameNormalized: 'lattice-labs', industry: 'Software', hqMetro: 'Boston', openRoles: 1, contacts: 1, rank: 3, band: 'worth_a_look', ranking: { reasons: ['Your interview is Thursday, so it is worth learning more.'], cautions: [] } },
  { id: 'c4', name: 'State Street', canonicalNameNormalized: 'state-street', industry: 'Finance', hqMetro: 'Boston', openRoles: 0, contacts: 0, rank: 4, band: 'long_shot', ranking: { reasons: [], cautions: [] } },
]

export function CompaniesLive() {
  return (
    <PreviewShell place="jobs" entry="companies">
      <CompaniesRedesign
        rows={COMPANY_ROWS}
        query=""
        sort="fit"
        filters={[
          { key: 'jobs', label: 'Has open roles', checked: false },
          { key: 'mine', label: 'You have a contact here', checked: false },
          { key: 'noContracting', label: 'Hide contracting companies', checked: false },
        ]}
        anyFilter={false}
        page={1}
        pageCount={1}
        pageSize={25}
        totalCount={COMPANY_ROWS.length}
        newStrongCount={2}
        buildHref={() => ''}
        more={
          <AiPayPremiumCard
            redesign
            functionName="Operations"
            row={{ function: 'Operations', withAi: 38, withoutAi: 212, premiumPct: 9, medianWithAi: 215000, medianWithoutAi: 198000 }}
          />
        }
      />
    </PreviewShell>
  )
}

// ---- Your market -------------------------------------------------------------------------------------------------

const MARKET: AddressableMarket = {
  role: { key: 'ops-director', label: 'Director of Operations' },
  placeLabel: 'Greater Boston',
  local: 63,
  remote: 48,
  national: 1840,
  trendPct: -0.06,
  ai: {
    group: 'Management',
    socGroup: '11',
    exposure: 0.31,
    employmentChangePct: 2.4,
    trend: 'growing',
    aiSkills: 'important',
    line: 'Operations leaders who use AI for planning and reporting are asked for more often, and the work itself is not shrinking.',
    tools: 'AI for planning, reporting and decisions; leading a team that uses AI tools',
    source: 'NextChapter White Collar Employment Report',
  },
  flags: [{ key: 'geo', title: 'Your place holds a small share of the market', detail: 'Greater Boston has about 3% of these jobs. Adding remote roles would more than double what you can apply to.' }],
  expansions: [
    { kind: 'remote', open: 48, label: 'Remote roles' },
    { kind: 'state', state: 'NY', open: 210, label: 'Jobs in New York' },
    { kind: 'role', role: 'chief-of-staff', label: 'Chief of Staff', open: 41, fitLabel: 'Closely related', carry: ['operations', 'leadership', 'planning'], toAdd: ['board and investor experience'], ai: null },
    { kind: 'role', role: 'program-director', label: 'Program Director', open: 29, fitLabel: 'Related', carry: ['program management'], toAdd: [], ai: null },
    { kind: 'industry', industry: 'Healthcare', label: 'Healthcare', open: 87 },
    { kind: 'industry', industry: 'Logistics', label: 'Logistics', open: 52 },
  ],
  optedIn: { remote: false, states: [], roles: [], industries: [], at: null },
  marketReady: true,
}

export function MarketLive() {
  return (
    <PreviewShell place="jobs" entry="market" part="market">
      <MarketRedesign m={MARKET} />
    </PreviewShell>
  )
}

// ---- Know your worth -------------------------------------------------------------------------------------------------

export function PayLive() {
  const t = payPositionText({ pay: 245000, shareBelow: 0.62, role: 'Director of Operations', place: 'Massachusetts', p25: 190000, p50: 232000, p75: 285000 })
  return (
    <PreviewShell place="jobs" entry="market" part="pay">
      <PayRedesign
        top={['INDEPENDENCE', 'SUPPORT']}
        asks={['Four weeks of vacation', 'A hybrid schedule']}
        position={<VerdictPanel id="pay-position" title={t.headline} because={t.because} />}
        filed={
          <OfferedWagesView
            role="operations managers"
            filings={1284}
            lo={176000}
            mid={218000}
            hi={262000}
            lastSalary={245000}
            tracked={[
              { employer: 'Harbor Health', occupation: 'Medical and health services managers', median: 205000, filings: 31, topState: 'MA' },
              { employer: 'Northwind', occupation: 'Operations research analysts', median: 174000, filings: 12, topState: null },
            ]}
          />
        }
        market={<p className="text-base text-muted-foreground">The chart of advertised salaries for your role goes here.</p>}
      />
    </PreviewShell>
  )
}

// ---- Résumé -------------------------------------------------------------------------------------------------

const VERSIONS: ResumeVersionItem[] = [
  { id: 'r1', fileName: 'kulla-operations.pdf', label: 'Operations leadership', description: 'The one I send for COO and VP roles', uploadedAt: daysAgo(3), isLatest: true, signedUrl: null, atsScore: 82, atsFeedback: [], resultsScore: 61, resultsFeedback: [{ title: 'Add numbers', detail: 'Three bullets describe duties, not results.' } as never], experienceScore: 74, experienceFeedback: [{ title: 'Order', detail: 'Lead with the most recent role.' } as never], analysisError: null },
  { id: 'r2', fileName: 'kulla-healthcare.pdf', label: 'Healthcare operations', description: null, uploadedAt: daysAgo(40), isLatest: false, signedUrl: null, atsScore: 88, atsFeedback: [], resultsScore: 90, resultsFeedback: [], experienceScore: 85, experienceFeedback: [], analysisError: null },
]

const FIXES = [
  { dimension: 'Results', severity: 'high', whatsWrong: 'Three bullets describe duties instead of results.', fix: 'Start each with what changed and by how much.', pointValue: 6, rewrite: { before: 'Responsible for the operations budget.', after: 'Cut the operations budget 11% while adding two sites.' } },
  { dimension: 'Layout', severity: 'medium', whatsWrong: 'A two-column layout can scramble the order a recruiter’s software reads.', fix: 'Use a single column.', pointValue: 4, rewrite: null },
  { dimension: 'Summary', severity: 'medium', whatsWrong: 'The summary lists traits without proof.', fix: 'Replace two traits with one result.', pointValue: 3, rewrite: null },
  { dimension: 'Dates', severity: 'low', whatsWrong: 'Two roles have no end date.', fix: 'Add months and years to every role.', pointValue: 2, rewrite: null },
] as unknown as ResumeFixItem[]

export function ResumeLive() {
  return (
    <PreviewShell place="jobs" entry="apply" part="resume">
      <ResumeRedesign versions={VERSIONS} fixes={FIXES} narratives={[{ id: 'n1', label: 'Operations leader' }]} resumeBookOptIn />
    </PreviewShell>
  )
}

// ---- Why hire me -------------------------------------------------------------------------------------------------

const score = (key: string, label: string, evidence: string[]) => ({ key, label, score: 0.8, evidence, sources: evidence.length, pitch: '' })

const STRENGTHS = {
  shape: 'peaked',
  peaks: [
    score('execution', 'Gets things done', ['Your references rate you 4.8 of 5 on follow-through.', 'You led a 40-person program that shipped on time.']),
    score('leadership', 'Leads people', ['You have managed 41 to 200 people.', 'Two references name team-building as your strength.']),
    score('scale', 'Operates at scale', ['You owned a budget between $10M and $100M.']),
  ],
  broad: [],
  weakSpots: [{ key: 'influence', label: 'Influence and communication', line: 'Roles built on persuading skeptical buyers or executives' }],
  all: [],
  missing: ['One more reference would sharpen this', 'Take How I Perform to add your own read'],
  headline: 'You stand out for getting hard things done, and for the teams you build.',
  whyHire: {
    statement: 'I turn complicated operations into things that run on time, and I build the teams that keep them running.',
    proofPoints: ['Led a 40-person program that shipped on time and 11% under budget.', 'Two references name team-building as the reason they would work for me again.'],
    generatedAt: NOW.toISOString(),
  },
} as unknown as Strengths

export function StrengthsLive() {
  return (
    <PreviewShell place="jobs" entry="apply" part="whyhire">
      <StrengthsRedesign st={STRENGTHS} whyHire={<WhyHireView whyHire={STRENGTHS.whyHire!} />} />
    </PreviewShell>
  )
}

// ---- Local market -------------------------------------------------------------------------------------------------

const BRIEF = {
  area: { name: 'Greater Boston', stateName: 'Massachusetts', boardId: null },
  candidatesScope: 'area',
  candidates: {
    total: 214,
    landedRecently: 18,
    windowDays: 90,
    byJourney: [
      { key: 'laid_off', label: 'Laid off', count: 96 },
      { key: 'moving_up', label: 'Moving up', count: 61 },
    ],
    byStage: [
      { key: 'applying', label: 'Applying', count: 120 },
      { key: 'interviewing', label: 'Interviewing', count: 34 },
    ],
  },
  layoffs: {
    windowDays: 90,
    totalWorkers: 412,
    companies: [
      { employer: 'Acme Biotech', workers: 180, latestFiled: daysAgo(12) },
      { employer: 'Fenway Retail', workers: 120, latestFiled: daysAgo(30) },
      { employer: 'Quincy Foods', workers: null, latestFiled: daysAgo(44) },
    ],
  },
  hiring: {
    openRoles: 318,
    companies: [
      { name: 'Harbor Health', roles: 14 },
      { name: 'Northwind', roles: 9 },
      { name: 'State Street', roles: 7 },
    ],
  },
  news: [{ url: 'https://example.com/a', title: 'Boston hospitals add operations roles as volumes recover', publisher: 'Example Globe', publishedAt: daysAgo(3) }],
  funding: [],
} as unknown as AreaBrief

export function LocalLive() {
  return (
    <PreviewShell place="jobs" entry="market" part="local">
      <div className="space-y-8">
        <PageHeader
          title="Local market"
          intro="What is happening in Greater Boston. Other members appear only as anonymous counts."
          action={
            <ActionLink href="#" kind="primary">
              See jobs near you
            </ActionLink>
          }
        />
        <AreaBriefView brief={BRIEF} audience="member" redesign />
        <ShowMore page="local_market" label="Show workforce boards near you">
          <p className="text-base text-muted-foreground">Workforce boards panel.</p>
        </ShowMore>
      </div>
    </PreviewShell>
  )
}

// ---- Interviews -------------------------------------------------------------------------------------------------

export function InterviewsLive() {
  return (
    <PreviewShell place="jobs" entry="interviews">
      <div className="space-y-8">
        <PageHeader
          title="Interviews"
          intro="Get ready for the next one, and practice the questions that decide offers."
          action={
            <ActionLink href="#practice" kind="primary">
              Start practicing
            </ActionLink>
          }
        />
        <JobDescriptionCard initialValue={null} redesign />
        <section id="practice" aria-label="Practice" className="scroll-mt-4">
          <InterviewPrepTabs
            coreStatement="I turn complicated operations into things that run on time, and I build the teams that keep them running."
            adaptations={
              {
                friendsAndFamily: 'I run operations for hospitals, and I am looking for the next bigger one.',
                verbal30s: 'I run operations for a 600-person health system. I am looking for a COO role where the hard part is scale.',
                conversationOpener: 'What is the hardest operations problem you are working on right now?',
                resumeSummary: 'Operations leader who turns complicated systems into things that run on time.',
                coverLetterTemplate: 'Dear hiring team, ...',
                linkedinAbout: 'I run operations for hospitals ...',
                tellMeAboutYourself: 'I have spent fifteen years making operations run on time ...',
                emailOpening: 'I am writing because ...',
                linkedinHeadline: 'Operations leader | Healthcare | Scale',
              } as never
            }
            targetRoleType="Chief Operating Officer"
            storyComfort={3}
            interviewComfort={2}
            elevatorPitchReady={3}
            hasJobDescription={false}
            jobHoppingFlag={false}
            redesign
          />
        </section>
      </div>
    </PreviewShell>
  )
}
