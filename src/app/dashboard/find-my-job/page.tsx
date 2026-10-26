import type { Metadata } from 'next'
import { loadStrengths } from '@/lib/profile/strengths-load'
import { strengthKeys } from '@/lib/profile/strengths'
import { isLocationInArea, localAreaForCandidate } from '@/lib/workforce/local'
import { loadWorkProfile } from '@/lib/profile/work-profile-load'
import { Suspense } from 'react'
import { after } from 'next/server'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { surfaceNewJobs } from '@/lib/network/job-discovery'
import { getWatchlistView } from '@/lib/company-tracker/watchlist'
import { FIT_BUCKET_SORT_RANK, isWeakFit, type LevelStep } from '@/lib/jobs/fit-bucket-types'
import { fitScoreToLabel, type FitScoreLabel } from '@/lib/jobs/fit-score-label'
import { cn } from '@/lib/utils'
import { CompanyWatchlistForm } from '@/components/dashboard/CompanyWatchlistForm'
import { CompanyWatchlist } from '@/components/dashboard/CompanyWatchlistList'
import { MarkWatchlistViewedOnMount } from '@/components/dashboard/MarkWatchlistViewedOnMount'
import { EmailSyncWatcher } from '@/components/dashboard/EmailSyncWatcher'
import { EmailActivitySyncButton } from '@/components/dashboard/EmailActivityControls'
import { JobDetailsEditor } from '@/components/dashboard/JobDetailsEditor'
import { JobUrlForm } from '@/components/dashboard/JobUrlForm'
import { InterviewJobPicker } from '@/components/dashboard/InterviewJobPicker'
import { JobPostingTextFallback } from '@/components/dashboard/JobPostingTextFallback'
import { InterestedJobsList } from '@/components/dashboard/InterestedJobsList'
import { ShowMoreList } from '@/components/dashboard/ShowMoreList'
import { SeniorityFilter } from '@/components/dashboard/SeniorityFilter'
import { loadBoardShortlist, type BoardShortlist, type BoardView } from '@/lib/jobs/board-shortlist'
import { BoardViewToggle } from '@/components/dashboard/BoardViewToggle'
import { ScopeToggle } from '@/components/dashboard/ScopeToggle'
import { ExploreQuestionCard, ExploredOptionsList, PivotMessageCard } from '@/components/dashboard/PivotScopeCards'
import { applyScope, widenedFitNote } from '@/lib/jobs/search-scope'
import { loadScopeContext, type ScopeContext } from '@/lib/jobs/search-scope-server'
import { postingFunctions } from '@/lib/jobs/job-fit-bucket'
import { boardBreadthFor, MATCH_KIND_RANK, type Breadth, type MatchReason, type MemberBreadthVector } from '@/lib/jobs/search-breadth'
import { buildBridge, relevanceLine, type Bridge } from '@/lib/jobs/relevance'
import { subFunctionLabel } from '@/lib/jobs/sub-functions'
import { whyThisJob } from '@/lib/personalization/why-this-job'
import { jobIndustryBucket } from '@/lib/profile/industry-reading'
import { GoodMatchesMore } from '@/components/dashboard/GoodMatchesMore'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { PassedOnPanel } from '@/components/dashboard/PassedOnPanel'
import { MarketSizeSection } from '@/components/dashboard/MarketSizeSection'
import { MarketLine } from '@/components/dashboard/MarketLine'
import { SEARCH_TOO_FEW, SEARCH_TOO_MANY } from '@/components/dashboard/MarketSizeBlock'
import { becauseLine, DISMISS_REASONS, shouldAskToHide } from '@/lib/jobs/job-dismiss'
import { breadthReasonsFor } from '@/lib/jobs/search-breadth-server'
import { parseAiView, type AiView } from '@/lib/jobs/ai-view'
import { aiViewKeep, loadAiPostingIds } from '@/lib/jobs/ai-view-server'
import { loadPostingSignalMap } from '@/lib/jobs/posting-signals-server'
import { isOpenToChangers, parseOpenParam, wantsChangerLift } from '@/lib/jobs/posting-signals'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { OpenToChangersFilter } from '@/components/dashboard/OpenToChangersFilter'
import { EntryFilterChips } from '@/components/dashboard/EntryFilterChips'
import { ENTRY_FILTERS, parseEntryParam, passesEntryFilters, type EntryFilterKey } from '@/lib/jobs/entry-filters'
import { AiViewToggle } from '@/components/dashboard/AiViewToggle'
import { GreatEmployerFilter } from '@/components/dashboard/GreatEmployerFilter'
import { FunctionFilter } from '@/components/dashboard/FunctionFilter'
import { EmployerSectorFilter } from '@/components/dashboard/EmployerSectorFilter'
import { RequirementFilters } from '@/components/dashboard/RequirementFilters'
import { parseFunctionParam } from '@/lib/jobs/job-functions'
import { hiddenFromShown, parseSectorsParam, shownFromHidden } from '@/lib/jobs/employer-sector'
import { holdsClearance } from '@/lib/jobs/requirements'
import { combineKeeps, requirementKeeps, surfacedPassesBoardFilters, type BoardRequirementFilters } from '@/lib/jobs/board-filters'
import { employerSignalsFor, greatFilterPredicate, parseGreatParam, GREAT_FILTER_LABEL, type GreatFilter } from '@/lib/jobs/great-employers'
import { loadGreatSets, loadJobBenefits, loadPayHighCompanies } from '@/lib/jobs/great-employers-data'
import { COMPETITION_SORT_RANK, scoreCompetition } from '@/lib/jobs/competition'
import { boardRank, matchesParallelPath } from '@/lib/jobs/parallel-path-fit'
import { getParallelPaths } from '@/lib/job-reviews/data'
import { loadJobContacts } from '@/lib/jobs/job-contacts'
import { SENIORITY_GROUPS, classifyTitleRung, levelsInGroup, seniorityGroupOf, type SeniorityGroup } from '@/lib/jobs/job-seniority'
import { ALL_STAGES_WINDOW, memberStageWindow } from '@/lib/jobs/career-stage'
import { GoogleConnectPrompt } from '@/components/dashboard/GoogleConnectPrompt'
import { ReconnectBanner } from '@/components/dashboard/ReconnectBanner'
import { NetworkStatTile, type StatTileItem } from '@/components/dashboard/NetworkStatTile'
import { NextStepsToggle } from '@/components/dashboard/NextStepsToggle'
import { contactLinkType, CONTACT_LINK_ORDER } from '@/lib/dashboard/contact-link-type'
import {
  deleteJobPosting,
  retryJobFetch,
  markApplied,
  markInterviewLanded,
  markInterviewLandedFromForm,
  addInterviewJob,
  markOfferReceived,
  markDeclined,
  updateApplicationDetails,
  generateCoverLetterAction,
  prepForPhoneScreen,
  markInterviewComplete,
} from './actions'
import { ThankYouNoteCard } from '@/components/dashboard/ThankYouNoteCard'
import { MarkAppliedForm } from '@/components/dashboard/MarkAppliedForm'
import { ConversionDiagnosticCard } from '@/components/dashboard/ConversionDiagnosticCard'
import { SearchEfficiencyCard } from '@/components/dashboard/search-playbook/SearchEfficiencyCard'
import { loadSearchEfficiency } from '@/lib/dashboard/search-playbook-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { NegotiationPracticeTab } from '@/components/dashboard/NegotiationPracticeTab'
import { Card, CardContent } from '@/components/ui/card'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { applicationCountToTier } from '@/lib/network/application-count-tier'
import { MIN_APPLICATIONS_FOR_TRENDS, type ApplicationTrendsResult } from '@/lib/network/application-trends'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { dedupeByThread } from '@/lib/email-tracking/dedupe-by-thread'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Spinner } from '@/components/ui/spinner'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { getMatchedRolesForCandidate } from '@/lib/matching/candidate-role-matches'
import { MatchedRoleList } from '@/components/dashboard/MatchedRoleList'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'
import {
  bucketFromAssessment,
  computeBoardListingFitBucket,
  computeFitAssessment,
  computeSurfacedJobFitBucket,
} from '@/lib/jobs/job-fit-bucket'
import { CARD_VERDICT_LABEL, cardVerdict, levelPhrase } from '@/lib/jobs/job-card'
import { ConfidentialModeIndicator } from '@/components/dashboard/ConfidentialModeIndicator'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { resolveCompanySizeBands } from '@/lib/market/company-size'
import { normalizeOrgName, orgNamesMatch } from '@/lib/text/org-name-match'
import { getCurrentEmployerName, companyMatchesCurrentEmployer } from '@/lib/network/current-employer-flag'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { jobSkillGap } from '@/lib/jobs/job-skill-gap'
import { loadSkillsFit } from '@/lib/careers/skills-fit-server'
import { OnetAttribution } from '@/components/OnetAttribution'
import { matchJobToCandidate, toMatchJob } from '@/lib/jobs/job-match'
import { getCultureProfiles, getCulturePreferences } from '@/lib/companies/culture-profile'
import { countInsidersByCompany, hasTaggedEmployment } from '@/lib/companies/insider-network'
import { getCandidateMarketIntelTier, tierMeetsFeature } from '@/lib/market-intelligence/access'
import { isExplainGapsEnabled } from '@/lib/jobs/explain-gaps'
import { memberSkillKeywords } from '@/lib/jobs/skill-gap-data'
import { memberWorkType, defaultWorkTypes, parseWorkTypesParam, pathWorkTypes, roleProfileWorkType, WORK_TYPE_LABEL, type WorkType } from '@/lib/jobs/work-type'
import { loadMyJobs, trackKey, type MyJobsView } from '@/lib/jobs/my-jobs-data'
import { loadExpertNetworks, type ExpertNetworkCard } from '@/lib/jobs/expert-networks'
import { WorkTypeToggle } from '@/components/dashboard/one-board/WorkTypeToggle'
import { BoardTabs, type BoardTab } from '@/components/dashboard/one-board/BoardTabs'
import { ExpertNetworkRow } from '@/components/dashboard/one-board/ExpertNetworkRow'
import { earlyCareerAudience, featureVisible } from '@/lib/early-career/audience'
import { TuneStripSection } from '@/components/dashboard/TuneStripSection'
import { PageHeader } from '@/components/candidate/PageHeader'
import { SavedSearchesStrip } from '@/components/dashboard/SavedSearchesStrip'
import { ShowMore } from '@/components/candidate/ShowMore'
import { FindTwoPane } from '@/components/dashboard/find/FindTwoPane'
import { boardEntry, surfacedEntry } from '@/components/dashboard/find/entries'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { loadSalaryContext } from '@/lib/market/salary-context'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { MyJobsRedesign } from '@/components/dashboard/find/MyJobsRedesign'
import { AddJobAction } from '@/components/dashboard/find/AddJobAction'
import { FindParts, parseFindPart, type FindPart } from '@/components/dashboard/FindParts'
import { FIND_PART_HEADER } from '@/lib/jobs/find-part-copy'
import { FindUnpostedSection } from '@/components/dashboard/find/FindUnpostedSection'
import { FindIndependentSection } from '@/components/dashboard/find/FindIndependentSection'
import { FindResourcesSection } from '@/components/dashboard/find/FindResourcesSection'
import { FindPartLoading } from '@/components/dashboard/find/FindPartMessage'
import { MyTabAnchors } from '@/components/dashboard/one-board/MyTabAnchors'
import { PivotBoardBanner, PivotBoardPrompt } from '@/components/dashboard/pivots/PivotBoardBanner'
import { pivotBoardFilter, type PivotBoardFilter } from '@/lib/pivots/board-filter'
import { BoardSearchBar } from '@/components/dashboard/one-board/BoardSearchBar'
import { PastJobsToggle } from '@/components/jobs/PastJobsToggle'
import { PastJobsSection } from '@/components/jobs/PastJobsSection'
import { BoardSearchTracker } from '@/components/dashboard/one-board/BoardSearchTracker'
import { buildBoardSearch, warmSearchIndex, type BoardSearch } from '@/lib/jobs/board-search-index'
import { boardHref, boardHrefWithout, BOARD_SEARCH_URL_PARAMS } from '@/lib/jobs/board-url'
import {
  isSearchActive,
  metroLabel,
  parseBoardSearchParams,
  REMOTE_FILTER_LABEL,
  type BoardSearchParams,
} from '@/lib/jobs/board-search'

export const metadata: Metadata = { title: 'Find a job' }

const SURFACED_JOB_LIST_SIZE = 5
// Free candidates only ever see the first 3 automated-search-partner
// matches — the rest count toward the same "opportunities waiting" total
// the hamburger nav badge shows, but stay locked until the Dossier unlocks.
// Keeps the unreacted queue from silently ballooning: surfaceNewJobs used to
// fetch a fresh batch of up to 10 every time the queue dropped below
// SURFACED_JOB_LIST_SIZE, regardless of how close to that ceiling it already
// was — so a candidate who reacted to just one match could see the total
// jump from 4 to 14. Topping up only the shortfall to this fixed pool size
// keeps the number bounded and keeps the nav badge and this page's own
// count from ever drifting apart.
const SURFACED_JOB_POOL_TARGET = 10
const FIT_SCORE_BADGE_CLASS: Record<FitScoreLabel, string> = {
  'Perfect Fit': 'bg-success/10 text-success',
  'Strong Fit': 'bg-success/10 text-success',
  'Good Fit': 'bg-muted text-muted-foreground',
  'Poor Fit': 'bg-destructive/10 text-destructive',
}

const FIT_SCORE_TEXT_CLASS: Record<FitScoreLabel, string> = {
  'Perfect Fit': 'text-success',
  'Strong Fit': 'text-success',
  'Good Fit': 'text-foreground',
  'Poor Fit': 'text-destructive',
}

const APPLICATION_FOCUS_LABEL: Record<NonNullable<ApplicationTrendsResult['functionFocus']>, string> = {
  focused: 'Focused',
  mixed: 'A mix',
  scattered: 'Scattered',
}

const APPLICATION_VOLUME_LABEL: Record<NonNullable<ApplicationTrendsResult['volumeAssessment']>, string> = {
  too_few: 'Below a healthy pace',
  on_track: 'On pace',
  too_many: 'Very high volume',
}

// Mirrors the Application Trends block on the Market Reality Report — same
// data, same labels, just rendered inside a TierSummaryCard here instead of
// a full report section.
function ApplicationTrendsContent({ trends }: { trends: ApplicationTrendsResult }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {trends.functionFocus && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job function</p>
            <p className="mt-1 text-sm text-foreground">{APPLICATION_FOCUS_LABEL[trends.functionFocus]}</p>
            {trends.functionBreakdown && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {trends.functionBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
              </p>
            )}
          </div>
        )}
        {trends.industryFocus && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Industry</p>
            <p className="mt-1 text-sm text-foreground">{APPLICATION_FOCUS_LABEL[trends.industryFocus]}</p>
            {trends.industryBreakdown && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {trends.industryBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
              </p>
            )}
          </div>
        )}
        {trends.geographyFocus && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Geography</p>
            <p className="mt-1 text-sm text-foreground">{APPLICATION_FOCUS_LABEL[trends.geographyFocus]}</p>
            {trends.geographyBreakdown && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {trends.geographyBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
              </p>
            )}
          </div>
        )}
        {trends.volumeAssessment && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Application pace</p>
            <p className="mt-1 text-sm text-foreground">
              {APPLICATION_VOLUME_LABEL[trends.volumeAssessment]}
              {trends.applicationsPerWeek !== null && ` — ${trends.applicationsPerWeek}/week`}
            </p>
            {trends.volumeGoalPerWeek && (
              <p className="mt-0.5 text-xs text-muted-foreground">Your goal: {trends.volumeGoalPerWeek}/week</p>
            )}
          </div>
        )}
      </div>
      {(!trends.industryBreakdown || !trends.geographyBreakdown) && (
        <p className="text-xs text-muted-foreground">
          Industry and geography need more of your applications to have a company name or a fit check run — they&apos;ll
          fill in as you add more.
        </p>
      )}
    </div>
  )
}

interface InterviewPrep {
  likelyQuestions: string[]
  talkingPoints: string[]
  questionsToAsk: string[]
}

interface NegotiationAdvice {
  talkingPoints: string[]
  scriptOpening: string
  considerations: string[]
}

interface TailoredBullet {
  original: string
  tailored: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Fetching…',
  success: 'Analyzed',
  fetch_failed: 'Could not fetch this URL',
  parse_failed: 'Could not read this page',
  blocked: "This site can't be fetched automatically",
}

// Per-type empty states: what to do when a kind of work has nothing matching yet.
function EmptyTypeNote({ type }: { type: WorkType }) {
  switch (type) {
    case 'full_time':
      return (
        <>
          No full-time jobs match yet.{' '}
          <Link href="/dashboard/search-strategy" className="text-primary underline underline-offset-4">
            Add a target role or widen your search
          </Link>{' '}
          to see more.
        </>
      )
    case 'part_time':
      return (
        <>
          No part-time or fractional roles match yet. Most fractional work comes through marketplaces and your network —{' '}
          <a href="#independent-work" className="text-primary underline underline-offset-4">
            see the fractional marketplaces below
          </a>
          .
        </>
      )
    case 'contract':
      return (
        <>
          No contract roles match yet. Expert networks above pay for your time now, and the{' '}
          <a href="#independent-work" className="text-primary underline underline-offset-4">
            consultancy launch plan below
          </a>{' '}
          gets you to a first client.
        </>
      )
    case 'advisory':
      return (
        <>
          No advisory roles match yet — here&apos;s how to get on boards:{' '}
          <a href="#launch-phase-4" className="text-primary underline underline-offset-4">
            board and advisory directories
          </a>{' '}
          below, and the board-matched roles further down.
        </>
      )
  }
}

/** The board search as the results section sees it (see board-search.ts). */
interface BoardSearchView {
  params: BoardSearchParams
  /** Anything narrows the board (a sort alone only reorders it). */
  active: boolean
  matcher: BoardSearch | null
  /** Other board filters that are on, for analytics and the empty state. */
  filtersActive: string[]
  /** "for “VP finance” in Texas". */
  summary: string
  /** "remote " / "hybrid " / "on-site " before "jobs", or "". */
  arrangement: string
  /** Every current URL parameter, for the empty state's "broaden" links. */
  urlParams: Record<string, string>
}

function boardSearchSummary(p: BoardSearchParams): string {
  const parts: string[] = []
  if (p.q) parts.push(`for “${p.q}”`)
  if (p.loc) parts.push(`in ${/^metro:/i.test(p.loc) ? metroLabel(p.loc.slice(6).toUpperCase()) : p.loc}`)
  return parts.join(' ')
}

// No results: say what was searched and offer the ways to broaden it, each a link.
function BoardSearchEmpty({ search }: { search: BoardSearchView }) {
  const at = { hash: 'apply-new-jobs' }
  const p = search.params
  const broaden: { label: string; href: string }[] = []
  if (p.loc) broaden.push({ label: 'Search every location', href: boardHrefWithout(search.urlParams, ['loc'], at) })
  if (p.remote) broaden.push({ label: 'Show every work arrangement', href: boardHrefWithout(search.urlParams, ['remote'], at) })
  if (search.filtersActive.length > 0) {
    broaden.push({
      label: 'Turn off the other filters',
      href: boardHrefWithout(search.urlParams, ['seniority', 'view', 'great', 'pivot', 'types', 'ai', 'open'], at),
    })
  }
  if (p.q && (p.loc || p.remote)) broaden.push({ label: `Search “${p.q}” everywhere`, href: boardHrefWithout(search.urlParams, ['loc', 'remote'], at) })
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        No {search.arrangement}jobs {search.summary} yet.
      </p>
      <p>
        Try fewer or broader words, or the other form of an abbreviation (VP or vice president, FP&amp;A or financial planning).
        Quoted phrases must match exactly.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {broaden.map((b) => (
          <li key={b.label}>
            <a href={b.href} className="text-primary underline underline-offset-4">
              {b.label}
            </a>
          </li>
        ))}
        <li>
          <a href={boardHrefWithout(search.urlParams, BOARD_SEARCH_URL_PARAMS, at)} className="text-primary underline underline-offset-4">
            Clear the search
          </a>
        </li>
      </ul>
    </div>
  )
}

function JobRecommendationsSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Finding jobs that fit you…
    </div>
  )
}

// Carries the two heaviest calls on this page — surfaceNewJobs (a
// sequential external job-board API waterfall) and resolveCompanySizeBand
// (a live LLM call for any company name seen here for the first time) — in
// its own Suspense boundary so the rest of the page (stats, Interview
// Tracking, Application Tracker, Company Tracker) never blocks on them.
/**
 * Members whose board ranks welcoming jobs first within a fit level, and whose job tags lead with the
 * welcome (posting-signals.ts): changing careers (the flag, a pivot target or the journey) or early career.
 */
function changerLiftFor(profile: Awaited<ReturnType<typeof getDashboardData>>): boolean {
  return wantsChangerLift({ pivoting: !!profile.isPivoting || isPivotingProfile(profile), earlyCareer: earlyCareerAudience(profile) !== null })
}

async function JobRecommendationsSection({
  profile,
  candidatePlus,
  board,
  contacts,
  seniorityGroup,
  boardView,
  workTypes,
  parallelPaths,
  greatFilters,
  boardFilters,
  scopeCtx,
  pivotFilter,
  myJobs,
  expertNetworks,
  search,
  urlParams,
  aiView,
  openFilter = false,
  entryFilter = [],
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
  /** "Open to career changers / AI-upskilled" (posting-signals.ts): partner-search jobs carry no signals, so they hide. */
  openFilter?: boolean
  /** "No experience needed" / "Entry-level + AI" (entry-filters.ts): partner-search jobs carry no signals, so they hide. */
  entryFilter?: readonly EntryFilterKey[]
  /** AI / Non-AI / All (ai-view.ts): partner-search jobs carry no AI data, so they show under All only. */
  aiView: AiView
  /** Candidate+ (isDossierUnlocked): the extras on each job. Every member sees every job. */
  candidatePlus: boolean
  board: BoardShortlist
  /** The board search (null with none): results keep the shortlist's order (relevance / sort). */
  search: BoardSearchView | null
  /** Every current URL parameter: in-board links change one and keep the rest (board-url.ts). */
  urlParams: Record<string, string>
  seniorityGroup: SeniorityGroup | null
  boardView: BoardView
  workTypes: WorkType[]
  parallelPaths: string[] | null
  greatFilters: GreatFilter[]
  boardFilters: BoardRequirementFilters
  /** The search scope and what is outside home, for the lower-fit lines (search-scope.ts). */
  scopeCtx: ScopeContext
  pivotFilter: PivotBoardFilter | null
  myJobs: MyJobsView
  expertNetworks: ExpertNetworkCard[]
  contacts: {
    id: string
    name: string
    company: string | null
    inferredCompany: string | null
    email: string | null
    linkedinUrl: string | null
  }[]
}) {
  const MAX_WORKS_HERE_CONTACTS = 5
  const worksHereFor = (companyName: string | null) => {
    if (!companyName) return { contacts: [], totalCount: 0 }
    const matched = contacts
      .filter(
        (c) =>
          (c.company && orgNamesMatch(c.company, companyName)) ||
          (c.inferredCompany && orgNamesMatch(c.inferredCompany, companyName))
      )
      .map((c) => ({ id: c.id, name: c.name, email: c.email, linkedinUrl: c.linkedinUrl }))
      .sort((a, b) => CONTACT_LINK_ORDER[contactLinkType(a)] - CONTACT_LINK_ORDER[contactLinkType(b)])
    return { contacts: matched.slice(0, MAX_WORKS_HERE_CONTACTS), totalCount: matched.length }
  }
  // Auto-backfill the surfaced-job queue server-side so the list always
  // stays topped up at SURFACED_JOB_LIST_SIZE — reacting to one immediately
  // makes room for a fresh one rather than shrinking the list.
  const unreactedCount = await prisma.surfacedJob.count({
    where: { candidateId: profile.id, reaction: null },
  })
  if (unreactedCount < SURFACED_JOB_POOL_TARGET) {
    const toSurface = SURFACED_JOB_POOL_TARGET - unreactedCount
    if (unreactedCount === 0) {
      // Nothing to show yet — wait, so a first visit doesn't render an empty list.
      await surfaceNewJobs(profile.id, toSurface)
    } else {
      // The list already has jobs: render them now and top the pool up after
      // the response, same stale-while-revalidate tradeoff as the Gmail sync
      // in FindMyJobBody — new ones appear on the next load.
      after(() =>
        surfaceNewJobs(profile.id, toSurface).catch((error) => console.error('Surfaced job top-up failed:', error))
      )
    }
  }

  const [allSurfacedJobs, interestedJobs] = await Promise.all([
    prisma.surfacedJob.findMany({
      where: { candidateId: profile.id, reaction: null },
      orderBy: { surfacedAt: 'desc' },
      take: SURFACED_JOB_LIST_SIZE,
    }),
    prisma.surfacedJob.findMany({
      where: { candidateId: profile.id, reaction: 'INTERESTED' },
      orderBy: { reactedAt: 'desc' },
    }),
  ])

  // Partner-search jobs carry no stored level, so the seniority filter
  // classifies their titles the same way the board's jobs were levelled.
  // Great pay / great benefits: partner-search jobs carry no pay verdict or
  // benefits of their own, so only the employer-level signals can keep them.
  const [greatSets, payHighCompanies] = await Promise.all([
    greatFilters.length > 0 ? loadGreatSets() : Promise.resolve(null),
    loadPayHighCompanies(),
  ])
  const keepGreat = greatSets ? greatFilterPredicate(greatFilters, greatSets) : null
  const surfacedJobs = (
    seniorityGroup
      ? allSurfacedJobs.filter((j) => seniorityGroupOf(classifyTitleRung(j.title).rung) === seniorityGroup)
      : allSurfacedJobs
  ).filter(
    (j) =>
      workTypes.some((t) => t === memberWorkType(j)) &&
      (!keepGreat || keepGreat(j)) &&
      (!pivotFilter || pivotFilter.matchesTitle(j.title)) &&
      (!search?.matcher || search.matcher.matchesPlain(j) !== null) &&
      // Partner-search jobs carry no function, sector or requirement data: with one
      // of those filters on they can't be shown as matching it. With no sector
      // known they read as private.
      surfacedPassesBoardFilters(boardFilters) &&
      aiView === 'all' &&
      !openFilter &&
      entryFilter.length === 0
  )
  const signalLift = changerLiftFor(profile)
  const watchedFor = (companyName: string | null) => !!companyName && myJobs.watchedCompanies.has(normalizeOrgName(companyName))
  // Per selected type: anything to show at all? (drives the per-type empty notes)
  const shownTypes = new Set<WorkType>([
    ...surfacedJobs.map((j) => memberWorkType(j)).filter((t): t is WorkType => t !== null),
    ...(Object.entries(board.countByWorkType) as [WorkType, number][]).filter(([, n]) => n > 0).map(([t]) => t),
  ])
  const emptyTypes = workTypes.filter((t) => !shownTypes.has(t))

  // Every member sees every job (owner's rule, 2026-10-16).
  const visibleSurfacedJobs = surfacedJobs
  // The board's best-fitting jobs (see board-shortlist.ts) — the full
  // board is tens of thousands of rows; totals still count all of them.
  const openBoardPostings = board.open

  // computeBoardListingFitBucket/computeSurfacedJobFitBucket are synchronous
  // (called inline in the JSX below), but resolveCompanySizeBand isn't —
  // resolve every distinct company name shown in this section once, up
  // front, into a normalizeOrgName-keyed map so each card looks its band up
  // synchronously instead of awaiting per-card.
  const companyNames = [...openBoardPostings.map((p) => p.companyName), ...surfacedJobs.map((j) => j.companyName)].filter(
    (name): name is string => !!name
  )
  const distinctCompanyNames = [...new Set(companyNames)]
  const resolvedBands = await resolveCompanySizeBands(distinctCompanyNames)
  const companySizeBandByName = new Map(
    distinctCompanyNames.map((name, i) => [normalizeOrgName(name), resolvedBands[i].band])
  )
  const companySizeBandFor = (companyName: string | null) =>
    companyName ? (companySizeBandByName.get(normalizeOrgName(companyName)) ?? null) : null

  // A Targeted listing is only shown to candidates who actually fit it —
  // an Open one is shown to everyone regardless of fit (the bucket badge
  // still tells them how good a match it is).
  const visibleBoardPostings = openBoardPostings.filter((p) => {
    if (p.distribution !== 'TARGETED') return true
    return !isWeakFit(computeBoardListingFitBucket(profile, p, companySizeBandFor(p.companyName)))
  })
  // Company ownership (public / PE / VC) for the culture read — one query for the jobs shown.
  const companyIds = [...new Set(visibleBoardPostings.map((p) => p.companyId).filter((id): id is string => !!id))]
  // Confidential searches never get company-level culture or insider counts: that would
  // reveal the employer the card hides.
  const disclosedCompanyIds = [
    ...new Set(visibleBoardPostings.filter((p) => p.disclosure !== 'CONFIDENTIAL').map((p) => p.companyId).filter((id): id is string => !!id)),
  ]
  // How they like to work (work profile), for the per-job working-style read.
  const workProfile = await loadWorkProfile(profile.id).catch(() => null)
  const strengthKeysNow = await loadStrengths(profile.id).then(strengthKeys).catch(() => null)
  // A workforce program's region: its jobs rank first within each fit level.
  const area = await localAreaForCandidate(profile.id).catch(() => null)
  const local = area ? { label: area.label, isLocal: (loc: string | null) => isLocationInArea(area, loc) } : null
  const [contactsByPosting, companies, cultureProfiles, culturePrefs, insiderGate, benefitsByPosting, exposureMap, aiMarket, salary] = await Promise.all([
    loadJobContacts(visibleBoardPostings, profile.id),
    companyIds.length > 0
      ? prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, sizeBand: true, ownershipType: true, canonicalNameNormalized: true } })
      : Promise.resolve([]),
    // What members who worked at each company said (aggregate, privacy floor applied).
    getCultureProfiles(disclosedCompanyIds, profile.id),
    getCulturePreferences(profile.id),
    // Same gate as the company page's insider list: tagged employment + Plus Market Intelligence.
    Promise.all([hasTaggedEmployment(profile.id), getCandidateMarketIntelTier(profile.id)]).then(
      ([tagged, tier]) => tagged && tierMeetsFeature(tier, 'insider_network')
    ),
    // Structured benefits for the jobs shown (empty until the import sends them).
    loadJobBenefits(visibleBoardPostings.map((p) => p.id)),
    // Anthropic Economic Index scores (held in memory, fails soft) and the live AI pay comparison: once per page, never per row.
    loadExposureMap(),
    loadAiMarket().catch(() => null),
    // The member's last salary and home costs, and the area list: once per page, so each open job only does arithmetic.
    loadSalaryContext(profile).catch(() => null),
  ])
  // Pay / benefits badges: employer signals (hiring index + curated list) and the job's own benefits.
  // A confidential search names no employer, so it gets no employer badge.
  const employerSignalsOf = (p: (typeof visibleBoardPostings)[number]) =>
    p.disclosure === 'CONFIDENTIAL' ? undefined : employerSignalsFor(p.companyName, payHighCompanies)
  const insiderCounts = insiderGate ? await countInsidersByCompany(disclosedCompanyIds, profile.id) : new Map<string, number>()
  const companyById = new Map(companies.map((c) => [c.id, c]))
  const insidersFor = (p: (typeof visibleBoardPostings)[number]) => {
    const company = p.companyId ? companyById.get(p.companyId) : undefined
    const count = p.companyId ? (insiderCounts.get(p.companyId) ?? 0) : 0
    return company && count > 0 ? { count, href: `/dashboard/companies/${encodeURIComponent(company.canonicalNameNormalized)}#insiders` } : undefined
  }
  // Per-job match and gaps (skills, culture, salary, goals, working style) — rules only, no AI.
  const matchFor = (p: (typeof visibleBoardPostings)[number]) => {
    const company = p.companyId ? companyById.get(p.companyId) : undefined
    return matchJobToCandidate(
      { ...profile, culturePrefs, workProfile, strengthKeys: strengthKeysNow, local },
      toMatchJob(p, {
        sizeBand: company?.sizeBand ?? companySizeBandFor(p.companyName),
        ownershipType: company?.ownershipType ?? null,
        insiderCulture: p.companyId && p.disclosure !== 'CONFIDENTIAL' ? (cultureProfiles.get(p.companyId) ?? null) : null,
      })
    )
  }
  // Per-job skills gap, from the job's own description only.
  const memberKeywords = memberSkillKeywords(profile)
  // Separate from the fit badge: how this kind of work lines up with theirs, from O*NET (null until that data is loaded).
  const skillsFitFor = await loadSkillsFit(profile.id, memberKeywords).catch((error) => {
    console.error('Skills fit unavailable:', error)
    return null
  })
  // Why each job is on the board (search-breadth.ts): "Your field", "Pivot: …", "Skills match: …".
  const reasons: Map<string, MatchReason> = board.breadth.classifier
    ? breadthReasonsFor(board.breadth.classifier, visibleBoardPostings, memberKeywords)
    : new Map()
  // A ring job says which ring brought it in, briefly: "Your field · 45 mi away", "Pivot: … · one level up".
  for (const [id, info] of board.breadth.bridges) {
    const r = reasons.get(id)
    if (r) reasons.set(id, { ...r, label: [info.kind === 'function' ? r.label : 'Your field', ...info.notes].join(' · ') })
  }
  // Field, then pivots (a new industry counts as one), then skills matches, then everything a search kept.
  const reasonRank = (id: string) => {
    if (!board.breadth.classifier) return 0
    const r = reasons.get(id)
    return r ? (r.kind === 'industry_pivot' ? MATCH_KIND_RANK.pivot : MATCH_KIND_RANK[r.kind]) : 9
  }
  // Wide's one-relaxed jobs carry a bridge (relevance.ts): what transfers, what's missing, how to close it.
  const bridgeFor = (p: (typeof visibleBoardPostings)[number]): Bridge | undefined => {
    const c = board.breadth.classifier
    const info = board.breadth.bridges.get(p.id)
    if (!c || !info) return undefined
    const gap = skillGapFor(p)
    const company = p.companyId ? companyById.get(p.companyId) : undefined
    const soc = c.occupations.socs.get(p.id)
    return buildBridge({
      relaxed: info.kind,
      placeNote: info.notes.find((n) => / mi away|elsewhere in|where you'd move|next to /.test(n)) ?? null,
      levelNote: info.notes.find((n) => n.startsWith('one level')) ?? null,
      fieldLabel: subFunctionLabel(c.member.subFunction) ?? c.member.functionLabel ?? 'your field',
      have: gap.have,
      // The posting's own gaps first; with none listed, what its occupation uses that they don't show (O*NET).
      missing: gap.missing.length > 0 ? gap.missing : soc && c.member.occupationGaps ? c.member.occupationGaps(soc) : [],
      occupationShared: soc ? c.member.similar.get(soc)?.shared : undefined,
      jobIndustry: jobIndustryBucket(p.industry),
      companyName: p.disclosure === 'CONFIDENTIAL' ? null : p.companyName,
      companyHref: company && p.disclosure !== 'CONFIDENTIAL' ? `/dashboard/companies/${encodeURIComponent(company.canonicalNameNormalized)}#insiders` : null,
    })
  }
  const skillGapFor = (p: (typeof visibleBoardPostings)[number]) =>
    jobSkillGap({
      title: p.title,
      description: p.description,
      skills: p.skills,
      aiSkillItems: p.aiSkillItems,
      memberKeywords,
    })
  const competitionFor = (p: (typeof visibleBoardPostings)[number]) =>
    scoreCompetition(p, board.countByCompany.get(normalizeOrgName(p.companyName)) ?? 0)

  const shortlistOrder = new Map(openBoardPostings.map((p, i) => [p.id, i]))
  // Bridge jobs (a short market widened, or Wide's extras) get their own section after the strong matches.
  const bridgeIds = board.breadth.bridges
  const strongBoardPostings = search ? visibleBoardPostings : visibleBoardPostings.filter((p) => !bridgeIds.has(p.id))
  const bridgeBoardPostings = search ? [] : visibleBoardPostings.filter((p) => bridgeIds.has(p.id))
  // "Why this job": up to three fits and one honest gap, in one line (personalization/why-this-job.ts).
  const whyFor = (
    p: (typeof visibleBoardPostings)[number],
    match: ReturnType<typeof matchFor>,
    gap: ReturnType<typeof skillGapFor>,
    bridge: Bridge | undefined,
    level: LevelStep
  ) => {
    const c = board.breadth.classifier
    const crit = c ? (c.place(p)?.crit ?? c.criteria(p).crit) : null
    return whyThisJob({
      reason: reasons.get(p.id),
      crit,
      jobRemote: (p.targetRemotePolicy ?? '').toLowerCase() === 'remote' || statesFromLocation(p.location).isRemote,
      city: c?.member.geo?.anchor ? (profile.currentCity?.trim() ?? null) : null,
      hasIndustries: (c?.member.industries.size ?? 0) > 0,
      have: gap.have,
      missing: gap.missing,
      blocker: match.requirements.find((r) => r.status === 'blocker')?.label ?? null,
      bridgeGap: bridge ? bridge.missing.split(', ')[0].replace(/\.$/, '') : null,
      level: levelPhrase(level),
      // Their field by name instead of "Your field".
      field: c ? (subFunctionLabel(c.member.subFunction) ?? c.member.functionLabel) : null,
    })
  }
  const boardCard = (posting: (typeof visibleBoardPostings)[number]) => {
    // One fit score (fit scoring v2) gives both the bucket and the level step for the why line.
    const assessment = computeFitAssessment(profile, { ...posting, companySizeBand: companySizeBandFor(posting.companyName) })
    const fitBucket = bucketFromAssessment(assessment)
    const match = matchFor(posting)
    const gap = skillGapFor(posting)
    const bridge = bridgeFor(posting)
    const searchRank = search ? (shortlistOrder.get(posting.id) ?? shortlistOrder.size) : null
    const competition = competitionFor(posting)
    // A job in a widened area says why it fits less; it is never hidden (search-scope.ts).
    const lowerFit = widenedFitNote(
      { functions: postingFunctions(posting), industry: jobIndustryBucket(posting.industry), states: statesFromLocation(posting.location).states },
      scopeCtx.outside,
      scopeCtx.home
    )
    const baseWhy = whyFor(posting, match, gap, bridge, assessment.level)
    const why = lowerFit ? { ...baseWhy, lowerFit } : baseWhy
    const searchResult = searchRank !== null && search ? { rank: searchRank + 1, q: search.params.q, loc: search.params.loc } : undefined
    return {
      entry: boardEntry({
        posting,
        fitBucket,
        why,
        bridge,
        competition,
        contacts: contactsByPosting.get(posting.id),
        skillGap: gap,
        skillsFit: skillsFitFor?.(posting.title),
        match,
        explainGapsEnabled: isExplainGapsEnabled(),
        insiders: insidersFor(posting),
        track: myJobs.cardStates.get(trackKey('job_board', posting.id)),
        watched: watchedFor(posting.companyName),
        employer: employerSignalsOf(posting),
        benefits: benefitsByPosting.get(posting.id),
        searchResult,
        matchReason: reasons.get(posting.id),
        candidatePlus,
        signalLift,
        exposureMap,
        aiMarket,
        salary,
      }),
      // A search keeps the shortlist's order (relevance, then fit — or the chosen sort).
      rank:
        searchRank !== null
          ? searchRank
          : reasonRank(posting.id) * 1000 +
            boardRank(FIT_BUCKET_SORT_RANK[fitBucket], COMPETITION_SORT_RANK[competition.level], matchesParallelPath(posting, parallelPaths)) -
            (local?.isLocal(posting.location) ? 0.5 : 0),
    }
  }
  const searchResultCount = board.openTotal + surfacedJobs.length

  // The same jobs in the same order as two panes: a list row and the open job for each.
  // Bridge jobs ("Worth a look") follow the strong matches; partner-search jobs rank as they always have.
  const findEntries = [
    ...strongBoardPostings.map((p) => boardCard(p)).map((c) => ({ rank: c.rank, entry: c.entry })),
    ...bridgeBoardPostings.map((p) => boardCard(p)).map((c) => ({ rank: 1_000_000 + c.rank, entry: c.entry })),
    ...visibleSurfacedJobs.map((job) => {
      const fitBucket = computeSurfacedJobFitBucket(profile, job, companySizeBandFor(job.companyName))
      const worksHere = worksHereFor(job.companyName)
      return {
        rank: (search ? shortlistOrder.size + 1 : 0) + boardRank(FIT_BUCKET_SORT_RANK[fitBucket], 1, matchesParallelPath(job, parallelPaths)),
        entry: surfacedEntry({
          job,
          fitBucket,
          worksHereContacts: worksHere.contacts.map((c) => ({ id: c.id, name: c.name })),
          worksHereTotalCount: worksHere.totalCount,
          track: myJobs.cardStates.get(trackKey('surfaced', job.id)),
          watched: watchedFor(job.companyName),
        }),
      }
    }),
  ]
    .sort((a, b) => a.rank - b.rank)
    .map((e) => e.entry)

  return (
    <div className="space-y-4">
      {workTypes.includes('contract') && <ExpertNetworkRow networks={expertNetworks} />}
      {emptyTypes.length > 0 && (visibleBoardPostings.length > 0 || surfacedJobs.length > 0) && (
        <ul className="space-y-1">
          {emptyTypes.map((t) => (
            <li key={t} className="text-sm text-muted-foreground">
              <EmptyTypeNote type={t} />
            </li>
          ))}
        </ul>
      )}
      {search && search.active && (
        <BoardSearchTracker
          q={search.params.q}
          loc={search.params.loc}
          remote={search.params.remote}
          sort={search.params.sort}
          resultCount={searchResultCount}
          filtersActive={search.filtersActive}
          fullIndex={search.matcher?.indexReady ?? true}
        />
      )}
      {search && search.active && search.matcher && !search.matcher.indexReady && (
        <p className="text-xs text-muted-foreground" role="status">
          Matched on job titles, companies and locations for now — skills and industries are still loading.{' '}
          <TrackedLink
            href={boardHref(urlParams, {}, { hash: 'apply-new-jobs' })}
            event="job_search_full_index_retried"
            properties={{ q: search.params.q, loc: search.params.loc, remote: search.params.remote, resultCount: searchResultCount }}
            className="text-primary underline underline-offset-4"
          >
            Search again with skills and industries
          </TrackedLink>
        </p>
      )}
      {search && search.active && (searchResultCount >= SEARCH_TOO_MANY || searchResultCount < SEARCH_TOO_FEW) && (
        <Suspense fallback={null}>
          <MarketSizeSection member={profile} surface="board_search" searchCount={searchResultCount} searchQuery={search.params.q} />
        </Suspense>
      )}
      {/* Everyone sees their market in one line. The fuller block above already says it when a search is too wide or too narrow, so the line steps aside then. */}
      {!(search && search.active && (searchResultCount >= SEARCH_TOO_MANY || searchResultCount < SEARCH_TOO_FEW)) && (
        <Suspense fallback={null}>
          <MarketLine member={profile} surface="board" />
        </Suspense>
      )}
      {search && search.active && searchResultCount > 0 && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">
            {searchResultCount.toLocaleString()} {search.arrangement}job{searchResultCount === 1 ? '' : 's'}
          </span>{' '}
          {search.summary}
        </p>
      )}
      {search && search.active && visibleBoardPostings.length === 0 && surfacedJobs.length === 0 ? (
        <BoardSearchEmpty search={search} />
      ) : visibleBoardPostings.length === 0 && surfacedJobs.length === 0 ? (
        <div className="space-y-1 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {entryFilter.length > 0 ? (
            <p>
              No jobs match {ENTRY_FILTERS.filter((f) => entryFilter.includes(f.key)).map((f) => f.label).join(' and ')} with these filters yet. Turn it
              off to see every job.
            </p>
          ) : openFilter ? (
            <p>No jobs that fit you say they welcome career changers or people learning AI with these filters yet. Turn off Open to career changers to see every job.</p>
          ) : aiView !== 'all' ? (
            <p>
              No {aiView === 'ai' ? 'jobs that ask for a specific AI skill' : 'jobs without an AI skill ask'} fit you with these filters yet.
              Choose All to see every job.
            </p>
          ) : greatFilters.length > 0 ? (
            <p>
              No jobs that fit you are marked {greatFilters.map((f) => GREAT_FILTER_LABEL[f].toLowerCase()).join(' and ')} with these
              filters yet. Turn one off to see more.
            </p>
          ) : (
            workTypes.map((t) => (
              <p key={t}>
                <EmptyTypeNote type={t} />
              </p>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {board.freshOpenTotal > 0 && boardView !== 'fresh' && (
            <p className="rounded-md border border-orange/40 bg-orange/10 px-3 py-2 text-sm text-foreground">
              <span className="font-medium">
                {board.freshOpenTotal} job{board.freshOpenTotal === 1 ? '' : 's'} that fit you{' '}
                {board.freshOpenTotal === 1 ? 'was' : 'were'} posted in the last 72 hours.
              </span>{' '}
              Early applicants get most of the interviews — apply to these first.{' '}
              <a href={boardHref(urlParams, { view: 'fresh' }, { hash: 'job-recommendations' })} className="text-primary underline underline-offset-4">
                Show them
              </a>
            </p>
          )}
          {pathWorkTypes(parallelPaths).length > 0 && workTypes.some((t) => t === 'contract' || t === 'part_time') && (
            <p className="text-xs text-muted-foreground">
              Contract and part-time roles that match what you&apos;re doing alongside your search are listed ahead of similar roles at the
              same fit level.{' '}
              <a href="/dashboard/past-jobs#parallel-heading" className="text-primary underline underline-offset-4">
                Change what you&apos;re doing
              </a>
            </p>
          )}
          <FindTwoPane
            items={findEntries.map((e) => e.item)}
            details={Object.fromEntries(findEntries.map((e) => [e.item.id, e.detail]))}
            summary={`${findEntries.length} ${search?.active ? 'matching ' : ''}${findEntries.length === 1 ? 'job' : 'jobs'}, best fit first`}
          />

          {board.breadth.goodMoreIds.length > 0 && <GoodMatchesMore ids={board.breadth.goodMoreIds} surface="find_my_job" />}
        </div>
      )}

      {skillsFitFor && <OnetAttribution />}

      <InterestedJobsList jobs={interestedJobs} />
    </div>
  )
}

export default async function JobFitPage({
  searchParams,
}: {
  searchParams: Promise<{
    seniority?: string
    view?: string
    types?: string
    tab?: string
    part?: string
    great?: string
    pivot?: string
    q?: string
    loc?: string
    remote?: string
    sort?: string
    fn?: string
    sectors?: string
    blockers?: string
    cleared?: string
    breadth?: string
    scope?: string
    ai?: string
    open?: string
    entry?: string
  }>
}) {
  const baseProfile = await getDashboardData()
  const allParams = await searchParams
  // Search scope (search-scope.ts): Narrow reads home only, Broader adds the options that are on (what the board
  // did before scope existed), Everything adds every explored option. The fit score reads the scoped profile.
  const scopeCtx = await loadScopeContext(baseProfile, allParams.scope)
  const profile = applyScope(baseProfile, scopeCtx.resolved)
  const part = parseFindPart(allParams.part)
  const { seniority, view, types, tab: tabParam, great, pivot, fn, sectors, blockers, cleared } = allParams
  const boardSearch = parseBoardSearchParams(allParams)
  // Other board filters that are on (search analytics, and the no-results suggestions).
  const filtersActive = [
    seniority && 'seniority',
    view && view !== 'all' && 'view',
    great && 'great',
    pivot && 'pivot',
    types && 'types',
    fn && 'fn',
    sectors && 'sectors',
    blockers && 'blockers',
    cleared && 'cleared',
    allParams.ai && parseAiView(allParams.ai) !== 'all' && 'ai',
    parseOpenParam(allParams.open) && 'open',
    parseEntryParam(allParams.entry).length > 0 && 'entry',
  ].filter((f): f is string => !!f)
  // `job` (the open job in the two-pane list) belongs to the list alone: links built from the other parameters
  // start without it, so a new filter or search never reopens an old job.
  const urlParams = Object.fromEntries(
    Object.entries(allParams).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0] !== 'job')
  )
  const greatFilters = parseGreatParam(great)
  // Function, employer sector and hard-requirement filters (job-functions.ts,
  // employer-sector.ts, requirements.ts). Sectors: the URL wins (a shared link or a
  // toggle just clicked), else the member's saved choice.
  const boardFilters: BoardRequirementFilters = {
    functionKey: parseFunctionParam(fn),
    sectorsShown: parseSectorsParam(sectors) ?? shownFromHidden(profile.hiddenEmployerSectors),
    hideBlockers: blockers === 'hide',
    clearedOnly: cleared === '1' && holdsClearance(profile),
  }
  // Pivot paths' "Show me these jobs": the board narrowed to one pivot target's titles.
  const pivotFilter = pivotBoardFilter(pivot)
  // Search breadth (search-breadth.ts): the URL, else the member's saved choice, else
  // Narrow for senior members and Wide for junior ones. A pivot path or an explicit
  // function filter already says which jobs to show, so breadth is off then.
  // The scope sets the reach: Narrow keeps to the member's field, Everything goes as wide as the board does,
  // and Broader keeps their saved or default breadth.
  const breadth: Breadth = scopeCtx.scope === 'narrow' ? 'narrow' : scopeCtx.scope === 'everything' ? 'wide' : boardBreadthFor(profile, allParams.breadth)
  const breadthMode: Breadth | 'off' = pivotFilter || urlParams.fn ? 'off' : breadth
  const seniorityGroup = SENIORITY_GROUPS.find((g) => g.key === seniority)?.key ?? null
  const boardView: BoardView = view === 'fresh' || view === 'low_competition' ? view : 'all'
  // The URL wins (a shared link or a toggle just clicked); otherwise the member's
  // saved choice, otherwise what they told us in onboarding.
  const tab: BoardTab = tabParam === 'my_jobs' ? 'my_jobs' : 'board'
  const [parallelPaths, trackedCount, applicationCount] = await Promise.all([
    // What the member does alongside the search: shows contract / part-time by default and ranks matching roles higher.
    getParallelPaths(profile.id),
    prisma.trackedJob.count({ where: { candidateId: profile.id, dismissedAt: null, OR: [{ savedAt: { not: null } }, { jobPostingId: { not: null } }] } }),
    prisma.jobPosting.count({ where: { candidateId: profile.id, appliedAt: { not: null }, trackedJob: null } }),
  ])
  const workTypes = parseWorkTypesParam(types) ?? defaultWorkTypes({ ...profile, parallelPaths })

  return (
    <div className="space-y-10">
      <MarkWatchlistViewedOnMount />
      {tab === 'my_jobs' ? (
        <PageHeader
          title="My jobs"
          intro="Every job you have saved or applied to, with the next step for each."
          action={
            <AddJobAction
              atCap={profile.jobPostings.filter((j) => j.source === 'MANUAL' && j.interviewLandedAt === null && j.offerReceivedAt === null).length >= MAX_ACTIVE_FIT_CHECK_SLOTS}
            />
          }
        />
      ) : (
        <PageHeader title={FIND_PART_HEADER[part].title} intro={FIND_PART_HEADER[part].intro} />
      )}

      {tab === 'my_jobs' && <SavedSearchesStrip email={profile.email} />}
      <MyTabAnchors onMyJobs={tab === 'my_jobs'} />
      <BoardTabs current={tab} myJobsCount={trackedCount + applicationCount} />
      {tab === 'board' && <FindParts current={part} independent={featureVisible('interim_launch_plan', earlyCareerAudience(profile))} urlParams={urlParams} />}

      {profile.confidentialSearchMode && <ConfidentialModeIndicator />}

      <Suspense fallback={<FindMyJobBodySkeleton />}>
        <FindMyJobBody
          profile={profile}
          seniorityGroup={seniorityGroup}
          boardView={boardView}
          workTypes={workTypes}
          parallelPaths={parallelPaths}
          greatFilters={greatFilters}
          tab={tab}
          pivotFilter={pivotFilter}
          boardSearch={boardSearch}
          filtersActive={filtersActive}
          urlParams={urlParams}
          boardFilters={boardFilters}
          breadthMode={breadthMode}
          scopeCtx={scopeCtx}
          aiView={parseAiView(allParams.ai)}
          openFilter={parseOpenParam(allParams.open)}
          entryFilter={parseEntryParam(allParams.entry)}
          part={part}
        />
      </Suspense>
    </div>
  )
}

/** "near Sunnyvale or remote", "in WA, OR, ID or remote": where their jobs count (relevance.ts). */
function placePhrase(profile: { currentCity: string | null }, m: MemberBreadthVector): string | null {
  const g = m.geo
  if (!g || g.unknown) return null
  const parts: string[] = []
  if (g.anchor && profile.currentCity) parts.push(`near ${profile.currentCity}`)
  else if (g.homeState) parts.push(`in ${g.homeState}`)
  if (g.acceptsRemote) parts.push('remote')
  return parts.length > 0 ? parts.join(' or ') : null
}

const DISMISS_REASON_LABEL = new Map<string, string>(DISMISS_REASONS.map((r) => [r.key, r.label.toLowerCase()]))

function FindMyJobBodySkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Loading your job search…
    </div>
  )
}

// Carries the Gmail sync (a live external API call, throttled to once per 5
// minutes but still a real network round trip on the un-throttled path) plus
// every section whose data depends on its freshly-synced jobPostings —
// stats, Interview Tracking, and the Application Tracker — in its own
// Suspense boundary so the page header above renders immediately instead of
// blocking on this every single visit.
async function FindMyJobBody({
  profile,
  seniorityGroup,
  boardView,
  workTypes,
  parallelPaths,
  greatFilters,
  tab,
  pivotFilter,
  boardSearch,
  filtersActive,
  urlParams,
  boardFilters,
  breadthMode,
  scopeCtx,
  aiView,
  openFilter,
  entryFilter,
  part,
}: {
  /** "Open to career changers / AI-upskilled" (the `open` URL parameter, posting-signals.ts). */
  openFilter: boolean
  /** "No experience needed" / "Entry-level + AI" (the `entry` URL parameter, entry-filters.ts). */
  entryFilter: EntryFilterKey[]
  profile: Awaited<ReturnType<typeof getDashboardData>>
  /** One part of the board at a time (docs/candidate-redesign.md): jobs, not posted yet, independent work, resources. */
  part: FindPart
  seniorityGroup: SeniorityGroup | null
  boardView: BoardView
  workTypes: WorkType[]
  parallelPaths: string[] | null
  greatFilters: GreatFilter[]
  tab: BoardTab
  pivotFilter: PivotBoardFilter | null
  boardSearch: BoardSearchParams
  filtersActive: string[]
  urlParams: Record<string, string>
  boardFilters: BoardRequirementFilters
  breadthMode: Breadth | 'off'
  /** The search scope and the pivot flag it raises (search-scope-server.ts). */
  scopeCtx: ScopeContext
  /** AI / Non-AI / All (ai-view.ts, the `ai` URL parameter). */
  aiView: AiView
}) {
  const onBoard = tab === 'board'
  // Each part of the board is its own view.
  const show = (p: FindPart) => part === p
  // Early-career members (src/lib/early-career/audience.ts) skip the
  // interim/fractional/board toolkit and expert networks: senior-only tools.
  const audience = earlyCareerAudience(profile)
  const showIndependentToolkit = featureVisible('interim_launch_plan', audience)
  // While a pivot filter is on, jobs are ranked as if the member were already in
  // the target function (their own function would rate every one a weak fit).
  const boardProfile = pivotFilter ? { ...profile, ...pivotFilter.candidateOverride } : profile
  // Changing careers or early career: welcoming jobs rank first within a fit level (posting-signals.ts).
  const changerLift = changerLiftFor(profile)
  // Job-application-related email activity (confirmations, recruiter
  // outreach, interview invites, rejections, offers) — auto-detected via
  // the same Gmail connection managed on the Network with My Contacts page.
  // Networking-shaped sent mail stays there; this page only shows the
  // job-outcome side of that same synced inbox.
  //
  // Backgrounded via after() rather than awaited — a heavy inbox (thousands
  // of messages) can make a real Gmail sync take long enough that awaiting
  // it here left the ENTIRE rest of this page (Interview Tracking, the
  // Application Tracker, thank-you notes, everything) stuck behind this
  // component's Suspense fallback for the whole wait, which read as "the
  // page is broken/empty" rather than "still loading." The tradeoff: a job
  // application landing via Gmail in just the last moment might not show up
  // until the *next* page load instead of this one — the same
  // stale-while-revalidate tradeoff already accepted everywhere else in
  // this app's slow-load fixes, and a far smaller cost than the whole page
  // appearing to vanish.
  const jobPostings = profile.jobPostings
  // Applications per conversation over the last four weeks (read-only, no
  // metered calls). See src/lib/jobs/search-efficiency.ts.
  // Started here and awaited with the batch below, so it runs alongside those reads instead of before them.
  const searchEfficiencyPromise = loadSearchEfficiency(profile.id)
  // EMAIL_DETECTED rows don't consume a fit-check slot — they were never
  // analyzed, so they shouldn't block adding a URL-based one.
  const activeCount = jobPostings.filter(
    (j) => j.source === 'MANUAL' && j.interviewLandedAt === null && j.offerReceivedAt === null
  ).length
  const atCap = activeCount >= MAX_ACTIVE_FIT_CHECK_SLOTS

  // Scoped to just the companies already-applied-to postings mention — the
  // separate, larger set of companies from board/surfaced listings is
  // resolved independently inside JobRecommendationsSection so that slower
  // lookup never blocks this page's main render.
  const appliedCompanyNames = [...new Set(jobPostings.map((j) => j.companyName).filter((n): n is string => !!n))]

  // Everything below that does not depend on another result starts at once:
  // the connection, the dossier status, the report, the contacts and the
  // size bands. The four email/calendar reads only need the connection, so
  // they chain off it instead of waiting for the dossier/board/watchlist.
  const emailConnectionPromise = prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })
  const loadEmailActivity = () =>
    Promise.all([
          prisma.trackedEmailActivity.findMany({
            where: { candidateId: profile.id, direction: 'INBOUND', dismissedAt: null, confidence: 'high' },
            orderBy: { detectedAt: 'desc' },
            take: 100,
          }),
          prisma.trackedEmailActivity.findMany({
            where: { candidateId: profile.id, direction: 'OUTBOUND', hasResumeAttachment: true, dismissedAt: null },
            orderBy: { detectedAt: 'desc' },
            take: 100,
          }),
          prisma.trackedEmailActivity.findMany({
            where: { candidateId: profile.id, isRecruiterContact: true, dismissedAt: null },
            orderBy: { detectedAt: 'desc' },
            take: 100,
          }),
          prisma.trackedCalendarEvent.findMany({
            where: { candidateId: profile.id, isRecruiterContact: true, dismissedAt: null },
            orderBy: { detectedAt: 'desc' },
            take: 100,
          }),
    ])
  const noEmailActivity: Awaited<ReturnType<typeof loadEmailActivity>> = [[], [], [], []]
  const emailActivityPromise = emailConnectionPromise.then((connection) =>
    connection ? loadEmailActivity() : noEmailActivity
  )

  // Attach the rejection handler up front so an early failure on the chained
  // promise can't surface as an unhandled rejection before it is awaited.
  emailActivityPromise.catch(() => undefined)

  const [
    emailConnection,
    currentEmployerName,
    dossierStatus,
    latestReport,
    appliedCompanyBands,
    contacts,
    jobsWithHelpfulContacts,
    searchEfficiency,
    greatSets,
    searchMatcher,
    aiIds,
    signalMap,
  ] = await Promise.all([
    emailConnectionPromise,
    // §4.8 — only fetched (and only ever true) for Confidential Search Mode
    // candidates.
    profile.confidentialSearchMode ? getCurrentEmployerName(profile.id) : Promise.resolve(null),
    isDossierUnlocked(profile.id),
    // Reads the same application-trends breakdown the Market Reality Report
    // shows, computed once at report-generation time — never recomputed
    // live here, since computeApplicationTrends calls resolveCompanyIndustry
    // (a real LLM call for a genuinely new company) and this page renders on
    // every visit, not just once a week like the report does.
    prisma.marketRealityReport.findFirst({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'desc' },
      select: { jobSearchPattern: true },
    }),
    resolveCompanySizeBands(appliedCompanyNames),
    // "Who can help with this one?" — contacts already manually linked to a
    // specific application, plus company-matched suggestions from the
    // candidate's own network list they haven't linked yet.
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id, OR: [{ company: { not: null } }, { inferredCompany: { not: null } }] },
      select: { id: true, name: true, company: true, inferredCompany: true, email: true, linkedinUrl: true },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId: profile.id },
      select: { id: true, helpfulContacts: { select: { id: true, name: true, email: true, linkedinUrl: true } } },
    }),
    searchEfficiencyPromise,
    // Great pay / great benefits (the `great` parameter): read only when a filter is on.
    greatFilters.length > 0 ? loadGreatSets() : Promise.resolve(null),
    // The board search (q / loc / remote / sort): matched on the in-memory board, board tab only.
    onBoard ? buildBoardSearch(boardSearch) : Promise.resolve(null),
    // AI / Non-AI: the ids of jobs that ask for an AI skill (cached; ~80 ms cold). Board tab only.
    onBoard ? loadAiPostingIds().catch((error) => {
      console.error('AI job ids unavailable, AI / Non-AI buttons hidden:', error)
      return null
    }) : Promise.resolve(null),
    // Posting signals (posting-signals-server.ts, cached): the open-to-changers filter and the welcome lift.
    onBoard && (openFilter || changerLift || entryFilter.length > 0) ? loadPostingSignalMap().catch((error) => {
      console.error('Posting signals unavailable, open-to-changers filter and lift off:', error)
      return null
    }) : Promise.resolve(null),
  ])
  // With no signals the filter can't be applied: show every job rather than none.
  const appliedOpenFilter = openFilter && !!signalMap
  const keepOpen = appliedOpenFilter ? (p: { id: string }) => isOpenToChangers(signalMap!.get(p.id)) : null
  const appliedEntryFilter = signalMap ? entryFilter : []
  const keepEntry = appliedEntryFilter.length > 0 ? (p: { id: string }) => passesEntryFilters(signalMap!.get(p.id), appliedEntryFilter) : null
  // With no AI ids the choice can't be applied: show every job rather than none.
  const appliedAiView: AiView = aiIds ? aiView : 'all'
  if (searchEfficiency.state !== 'NOT_ENOUGH_DATA') {
    captureServerEvent(profile.id, 'search_efficiency_viewed', {
      state: searchEfficiency.state,
      applications: searchEfficiency.applications,
      conversations: searchEfficiency.conversations,
      applicationsPerConversation: searchEfficiency.applicationsPerConversation,
    })
  }
  if (emailConnection) {
    after(() =>
      syncGmailConnection(emailConnection.id).catch((error) => console.error('Email auto-sync failed:', error))
    )
  }
  const preSyncLastSyncAt = emailConnection?.lastSyncAt?.toISOString() ?? null

  const applicationTrends =
    (latestReport?.jobSearchPattern as unknown as { applicationTrends: ApplicationTrendsResult | null } | null)
      ?.applicationTrends ?? null

  const isCandidatePlus = dossierStatus.unlocked
  // Every member sees every job; isCandidatePlus only turns on the extras on each job.
  // Employer-posted roles for the selected kinds of work (board and consulting
  // roles used to sit on the separate Interim Work page).
  const matchedRoleTypes = [
    ...(workTypes.includes('full_time') ? (['FULL_TIME'] as const) : []),
    ...(workTypes.includes('contract') || workTypes.includes('part_time') ? (['CONSULTING_PAID', 'CONSULTING_UNPAID'] as const) : []),
    ...(workTypes.includes('advisory') ? (['BOARD_PAID', 'BOARD_UNPAID'] as const) : []),
  ]
  const keepGreat = greatSets ? greatFilterPredicate(greatFilters, greatSets) : null
  const searchView: BoardSearchView | null =
    onBoard && (isSearchActive(boardSearch) || boardSearch.sort !== 'best')
      ? {
          params: boardSearch,
          active: isSearchActive(boardSearch),
          matcher: searchMatcher,
          filtersActive,
          summary: boardSearchSummary(boardSearch),
          arrangement: boardSearch.remote ? `${REMOTE_FILTER_LABEL[boardSearch.remote].toLowerCase()} ` : '',
          urlParams,
        }
      : null
  const [board, matchedRoles, watchlistView, myJobs, expertNetworks, passedOnJobs] = await Promise.all([
    loadBoardShortlist({
      candidate: boardProfile,
      isCandidatePlus,
      where: seniorityGroup ? { level: { in: levelsInGroup(seniorityGroup) } } : {},
      view: boardView,
      // The member's stage, one up and one down (career-stage.ts; a pivot path adds
      // one more down); a seniority-filter choice shows exactly that group instead.
      // The entry-level filters name the stage themselves, so every stage is in the window then.
      stageWindow: seniorityGroup || appliedEntryFilter.length > 0 ? ALL_STAGES_WINDOW : memberStageWindow(boardProfile),
      // One level beyond their own window is the last widening ring (relevance.ts) — not with an explicit seniority choice.
      seniorityRing: !seniorityGroup && appliedEntryFilter.length === 0,
      includeMidLevel: true,
      includeEarlyCareer: true,
      workTypes,
      keep: combineKeeps([
        keepGreat,
        keepOpen,
        keepEntry,
        pivotFilter ? (p) => pivotFilter.matchesTitle(p.title) : null,
        ...requirementKeeps(boardFilters, profile),
      ]),
      hiddenSectors: hiddenFromShown(boardFilters.sectorsShown),
      relevance: searchMatcher?.relevance,
      sort: onBoard && boardSearch.sort !== 'best' ? boardSearch.sort : undefined,
      // company:Name shows that company's jobs, not just its first five.
      perCompany: searchMatcher && searchMatcher.parsed.companies.length > 0 ? 300 : undefined,
      // Narrow / Wide. A search keeps every match (the member asked for them), ranked and labelled by breadth.
      breadth: breadthMode,
      breadthKeepUnmatched: !!searchView?.active,
      // AI / Non-AI / All, with each button's count (one more ranking pass each, in memory).
      views: aiIds
        ? { current: appliedAiView, keeps: { ai: aiViewKeep('ai', aiIds), other: aiViewKeep('other', aiIds), all: null } }
        : undefined,
      // The welcome lift: a tie-break within a fit level, after the level gate (board-shortlist.ts).
      lift: changerLift && signalMap ? (p) => isOpenToChangers(signalMap.get(p.id)) : undefined,
    }),
    matchedRoleTypes.length > 0 ? getMatchedRolesForCandidate(profile.id, [...matchedRoleTypes]) : Promise.resolve([]),
    getWatchlistView(profile.id),
    loadMyJobs(profile.id, memberSkillKeywords(profile)),
    onBoard && showIndependentToolkit && workTypes.includes('contract') ? loadExpertNetworks(profile.id) : Promise.resolve([]),
    // Board jobs they passed on, for "Review" (job-dismiss.ts).
    onBoard
      ? prisma.trackedJob.findMany({
          where: { candidateId: profile.id, source: 'job_board', dismissedAt: { not: null } },
          orderBy: { dismissedAt: 'desc' },
          take: 20,
          select: { sourceId: true, title: true, companyName: true, dismissReasons: true, dismissedAt: true },
        })
      : Promise.resolve([]),
  ])
  // The board is in: load this instance's search index in the background (a no-op
  // while it is fresh), so the member's first search finds it ready instead of
  // taking the light-fields fast path. Started now, after the board's own read so
  // it never competes with it; after() keeps the instance alive until it is in.
  if (onBoard) {
    void warmSearchIndex()
    after(warmSearchIndex)
  }
  const companySizeBandByName = new Map(
    appliedCompanyNames.map((name, i) => [normalizeOrgName(name), appliedCompanyBands[i].band])
  )
  const companySizeBandFor = (companyName: string | null) =>
    companyName ? (companySizeBandByName.get(normalizeOrgName(companyName)) ?? null) : null

  const helpfulContactsByJobId = new Map(jobsWithHelpfulContacts.map((j) => [j.id, j.helpfulContacts]))
  const MAX_SUGGESTED_HELP_CONTACTS = 5
  const whoCanHelpFor = (jobId: string, companyName: string | null) => {
    const linkedContacts = helpfulContactsByJobId.get(jobId) ?? []
    if (!companyName) return { linkedContacts, suggestedContacts: [] }
    const linkedIds = new Set(linkedContacts.map((c) => c.id))
    const suggestedContacts = contacts
      .filter(
        (c) =>
          !linkedIds.has(c.id) &&
          ((c.company && orgNamesMatch(c.company, companyName)) ||
            (c.inferredCompany && orgNamesMatch(c.inferredCompany, companyName)))
      )
      .map((c) => ({ id: c.id, name: c.name, email: c.email, linkedinUrl: c.linkedinUrl }))
      .sort((a, b) => CONTACT_LINK_ORDER[contactLinkType(a)] - CONTACT_LINK_ORDER[contactLinkType(b)])
      .slice(0, MAX_SUGGESTED_HELP_CONTACTS)
    return { linkedContacts, suggestedContacts }
  }

  // Every posting with appliedAt set is "My Applications", regardless of
  // whether it was pasted in manually or auto-detected from email.
  const allApplications = jobPostings
    .filter((j) => j.appliedAt !== null)
    .sort((a, b) => (b.appliedAt?.getTime() ?? 0) - (a.appliedAt?.getTime() ?? 0))
  const weekStart = getMondayOfWeek(new Date())
  const applicationsThisWeek = allApplications.filter((j) => j.appliedAt! >= weekStart).length

  // Interview Tracking section — a top-level rollup of everything already
  // marked interviewLandedAt, so a candidate doesn't have to dig into a
  // collapsed application card to see where they stand or jump to prep.
  const interviewingPostings = jobPostings
    .filter((j) => j.interviewLandedAt !== null)
    .sort((a, b) => b.interviewLandedAt!.getTime() - a.interviewLandedAt!.getTime())
  // Postings a candidate could plausibly say "I have an interview for this"
  // about — already applied (or an email-detected row, which is assumed
  // applied) and not already interviewing/declined/offered.
  const eligibleForInterview = jobPostings.filter(
    (j) =>
      j.interviewLandedAt === null &&
      j.declinedAt === null &&
      j.offerReceivedAt === null &&
      (j.source === 'EMAIL_DETECTED' || j.appliedAt !== null)
  )

  // Open board postings per company, keyed by normalized name — surfaced
  // next to each application so a candidate sees "3 open roles at Foo in
  // our job board" right where they're tracking that application.
  const boardPostingCountByCompany = board.countByCompany
  const boardPostingCountFor = (companyName: string | null) =>
    companyName ? (boardPostingCountByCompany.get(normalizeOrgName(companyName)) ?? 0) : 0

  const [jobEmailActivities, resumesSharedItems, emailRecruiterContactItems, calendarRecruiterContactItems] =
    await emailActivityPromise
  // A recruiter's follow-up or a scheduling back-and-forth otherwise counts
  // as a separate "contact"/"interview invite" per message in the thread —
  // collapse to one row per real conversation before building any stat tile
  // or count from these two. resumesSharedItems and calendar events are
  // left alone: each outbound resume-share is a genuinely separate action,
  // and calendar events don't share a Gmail threadId to collapse on anyway.
  const dedupedJobEmailActivities = dedupeByThread(jobEmailActivities)
  const dedupedEmailRecruiterContactItems = dedupeByThread(emailRecruiterContactItems)
  const jobEmailCounts = dedupedJobEmailActivities.reduce<Record<string, number>>((acc, a) => {
    acc[a.activityType] = (acc[a.activityType] ?? 0) + 1
    return acc
  }, {})
  const jobEmailItem = (a: (typeof jobEmailActivities)[number]): StatTileItem => ({
    id: a.id,
    kind: 'email',
    label: a.subject || (a.companyName ? `Email — ${a.companyName}` : 'Email'),
    date: a.detectedAt,
    detectedAs: a.activityType,
  })
  // Recruiter contact now covers both directions of email (a recruiter's
  // inbound outreach or the candidate's own outbound reply/cold outreach to
  // one) plus calendar events whose title/description mentions a recruiter
  // role — not just the INBOUND-only RECRUITER_OUTREACH email category.
  jobEmailCounts.RECRUITER_OUTREACH = dedupedEmailRecruiterContactItems.length + calendarRecruiterContactItems.length
  const jobStatTileItems: Record<string, StatTileItem[]> = {
    RECRUITER_OUTREACH: [
      ...dedupedEmailRecruiterContactItems.map(jobEmailItem),
      ...calendarRecruiterContactItems.map((e) => ({
        id: e.id,
        kind: 'calendar' as const,
        label: e.title || 'Calendar event',
        date: e.startTime,
      })),
    ],
    INTERVIEW_INVITE: dedupedJobEmailActivities.filter((a) => a.activityType === 'INTERVIEW_INVITE').map(jobEmailItem),
    REJECTION: dedupedJobEmailActivities.filter((a) => a.activityType === 'REJECTION').map(jobEmailItem),
    OFFER: dedupedJobEmailActivities.filter((a) => a.activityType === 'OFFER').map(jobEmailItem),
  }
  const JOB_EMAIL_LABEL: Record<string, string> = {
    RECRUITER_OUTREACH: 'Recruiter contact',
    INTERVIEW_INVITE: 'Interview invites',
    REJECTION: 'Rejections',
    OFFER: 'Offers',
  }

  return (
    <>
      <ReconnectBanner candidateId={profile.id} returnTo="/dashboard/find-my-job" />
      <GoogleConnectPrompt candidateId={profile.id} email={profile.email} returnTo="/dashboard/find-my-job" />

      {!onBoard && <MyJobsRedesign view={myJobs} />}

      {onBoard && show('jobs') && (
        <div id="apply-new-jobs" className="scroll-mt-4 space-y-6">
          <BoardSearchBar />
          {board.breadth.classifier && (
            <Suspense fallback={null}>
              <TuneStripSection profile={profile} />
            </Suspense>
          )}
          {pivotFilter && (
            <PivotBoardBanner
              target={pivotFilter.target}
              label={pivotFilter.label}
              openTotal={board.openTotal}
              clearHref={boardHrefWithout(urlParams, ['pivot'], { pathname: '/dashboard/find-my-job', hash: 'job-recommendations' })}
            />
          )}
          <div className="space-y-3">
            <ScopeToggle surface="find_my_job" current={scopeCtx.scope} />
            {scopeCtx.message && (
              <PivotMessageCard
                message={scopeCtx.message}
                counts={{ functions: scopeCtx.outside.functions.length, industries: scopeCtx.outside.industries.length, places: scopeCtx.outside.places.length }}
              />
            )}
            {scopeCtx.question && <ExploreQuestionCard question={scopeCtx.question} />}
            <ExploredOptionsList options={scopeCtx.options} />
          </div>
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-ink">Filters and views</summary>
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <PastJobsToggle />
                <WorkTypeToggle selected={workTypes} counts={board.countByWorkType} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {aiIds && (
                  <AiViewToggle
                    surface="find_my_job"
                    kind="jobs"
                    current={appliedAiView}
                    counts={{ ai: board.keptCounts.ai ?? 0, other: board.keptCounts.other ?? 0, all: board.keptCounts.all ?? 0 }}
                  />
                )}
                <BoardViewToggle surface="find_my_job" />
                <GreatEmployerFilter surface="find_my_job" />
                <SeniorityFilter surface="find_my_job" />
                <FunctionFilter surface="find_my_job" />
                <EmployerSectorFilter surface="find_my_job" shown={boardFilters.sectorsShown} />
                <RequirementFilters surface="find_my_job" hideBlockers={boardFilters.hideBlockers} clearedOnly={boardFilters.clearedOnly} holdsClearance={holdsClearance(profile)} />
                <OpenToChangersFilter surface="find_my_job" on={appliedOpenFilter} count={appliedOpenFilter ? board.openTotal : null} />
              </div>
              <EntryFilterChips surface="find_my_job" on={appliedEntryFilter} count={appliedEntryFilter.length > 0 ? board.openTotal : null} />
              {board.breadth.classifier && breadthMode !== 'off' && !searchView?.active && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {relevanceLine({
                    breadth: breadthMode,
                    relevant: board.breadth.relevantTotal,
                    shown: breadthMode === 'narrow' && !board.breadth.autoWidened ? board.breadth.narrowTotal : board.breadth.wideTotal,
                    autoWidened: board.breadth.autoWidened,
                    extras: board.breadth.extrasTotal,
                    field: `${subFunctionLabel(board.breadth.classifier.member.subFunction) ?? board.breadth.classifier.member.functionLabel ?? 'matching'}`,
                    place: placePhrase(profile, board.breadth.classifier.member),
                  })}
                </p>
              )}
            </div>
          </details>
          <div id="job-recommendations" className="scroll-mt-4">
            <Suspense fallback={<JobRecommendationsSkeleton />}>
              <JobRecommendationsSection
                profile={boardProfile}
                pivotFilter={pivotFilter}
                candidatePlus={isCandidatePlus}
                board={board}
                contacts={contacts}
                seniorityGroup={seniorityGroup}
                boardView={boardView}
                workTypes={workTypes}
                parallelPaths={parallelPaths}
                greatFilters={greatFilters}
                boardFilters={boardFilters}
                scopeCtx={scopeCtx}
                myJobs={myJobs}
                expertNetworks={expertNetworks}
                search={searchView}
                urlParams={urlParams}
                aiView={appliedAiView}
                openFilter={appliedOpenFilter}
                entryFilter={appliedEntryFilter}
              />
            </Suspense>
          </div>
          {(board.dismiss.rules && (board.dismiss.rules.preferences.length > 0 || passedOnJobs.length > 0)) || !pivotFilter ? (
            <ShowMore event="find_more_options_opened" properties={{ part: 'jobs' }} label="Jobs you passed on and other ways to search">
              {board.dismiss.rules && (board.dismiss.rules.preferences.length > 0 || passedOnJobs.length > 0) && (
                <PassedOnPanel
                  because={becauseLine(board.dismiss.rules.preferences)}
                  hiddenCount={board.dismiss.hidden}
                  preferences={board.dismiss.rules.preferences.map((p) => ({
                    id: p.id,
                    kind: p.kind,
                    label: p.label,
                    count: p.count,
                    action: p.action,
                    ask: shouldAskToHide(p),
                  }))}
                  jobs={passedOnJobs.map((j) => ({
                    jobId: j.sourceId,
                    title: j.title,
                    companyName: j.companyName,
                    reasons: j.dismissReasons.map((r) => DISMISS_REASON_LABEL.get(r) ?? r),
                    dismissedOn: j.dismissedAt!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  }))}
                />
              )}
              {!pivotFilter && (
                <Suspense fallback={null}>
                  <PivotBoardPrompt profile={profile} />
                </Suspense>
              )}
            </ShowMore>
          ) : null}
        </div>
      )}

      {/* Past jobs: a separate, labelled section, only with "Include past jobs" on (job-status.ts). */}
      {onBoard && show('jobs') && urlParams.past === '1' && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading past jobs…</p>}>
          <PastJobsSection search={boardSearch} />
        </Suspense>
      )}

      {/* SEC filings and news before a senior search: full-time searches. */}
      {onBoard && show('unposted') && (
        <Suspense fallback={<FindPartLoading label="Looking through filings and news for your background…" />}>
          <FindUnpostedSection profile={profile} types={workTypes} urlParams={urlParams} />
        </Suspense>
      )}
      {onBoard && show('jobs') && (
      <ShowMore label="Roles posted directly by employers" event="find_more_options_opened" properties={{ part: 'jobs', section: 'employer_matched_roles' }}>
      <div id="employer-matched-roles" className="scroll-mt-4 space-y-3">
        {/* Old Interim Work anchor (role-match emails link here). */}
        <span id="board-advisory-work" className="block scroll-mt-4" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Employer-matched roles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles posted directly by employers on NextChapter and matched to your background:{' '}
            {workTypes.map((t) => WORK_TYPE_LABEL[t].toLowerCase()).join(', ')}.
          </p>
        </div>
        <MatchedRoleList
          roles={matchedRoles.filter((r) => workTypes.includes(roleProfileWorkType(r.type)))}
          emptyMessage="No employer-posted roles match your background yet — check back soon."
        />
      </div>
      </ShowMore>
      )}

      {onBoard && show('independent') && showIndependentToolkit && (
        <Suspense fallback={<FindPartLoading label="Loading independent work…" />}>
          <FindIndependentSection profile={profile} types={workTypes} urlParams={urlParams} />
        </Suspense>
      )}
      {!onBoard && (
      <ShowMore label="Applications, email activity and company tracker" event="my_jobs_more_opened" properties={{ section: 'tracker' }}>
      {emailConnection && !emailConnection.needsReconnectAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <p>
              Job stats from email
              {emailConnection.lastSyncAt && <> · last checked {emailConnection.lastSyncAt.toLocaleString()}</>}
            </p>
            <EmailSyncWatcher initialLastSyncAt={preSyncLastSyncAt} />
          </div>
          <EmailActivitySyncButton />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Expandable like the tiles beside it, so a misread "application"
            can be spotted and removed (with a reason) instead of just counted. */}
        <NetworkStatTile
          label={`Applications sent · ${applicationsThisWeek} this week`}
          items={allApplications.map((j) => ({
            id: j.id,
            kind: 'application' as const,
            label: [j.title, j.companyName].filter(Boolean).join(' — ') || 'Application',
            date: j.appliedAt!,
            detectedAs: 'APPLICATION',
          }))}
        />
        {Object.entries(JOB_EMAIL_LABEL).map(([type, label]) => (
          <NetworkStatTile key={type} label={label} items={jobStatTileItems[type] ?? []} />
        ))}
        <NetworkStatTile label="Resumes shared" items={resumesSharedItems.map(jobEmailItem)} />
      </div>



      <div id="jobs-applied" className="scroll-mt-4 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Application Tracker</h2>

        {applicationTrends && (
          <TierSummaryCard
            title="Application Trends"
            count={applicationTrends.totalApplications}
            unitLabel="application"
            tier={applicationCountToTier(applicationTrends.totalApplications)}
            buildingAt={MIN_APPLICATIONS_FOR_TRENDS}
            highAt={MIN_APPLICATIONS_FOR_TRENDS}
            unlockedContent={<ApplicationTrendsContent trends={applicationTrends} />}
          />
        )}

        <SearchEfficiencyCard efficiency={searchEfficiency} />

        <ConversionDiagnosticCard jobPostings={jobPostings} />

        <div className="space-y-6 rounded-lg border border-border bg-card p-4">
        {jobPostings.length > 0 && (
          <div className="space-y-3">
            <p className="px-1 text-sm font-medium text-muted-foreground">
              {jobPostings.length} application{jobPostings.length === 1 ? '' : 's'}
            </p>
            <div className="divide-y divide-border rounded-md border border-border">
            <ShowMoreList pageSize={5}>
            {jobPostings.map((posting) => {
              const openRoles = boardPostingCountFor(posting.companyName)

              // Email-found and board-applied rows have no fit check — the simple status card.
              if (posting.source !== 'MANUAL') {
                const status = posting.offerReceivedAt
                  ? 'Offer received'
                  : posting.declinedAt
                    ? posting.declinedBy === 'CANDIDATE'
                      ? 'I passed'
                      : 'They passed'
                    : posting.interviewLandedAt
                      ? 'Interview'
                      : 'Applied'
                // Only computable once a title exists — a confirmation
                // subject rarely names the role, so this reads null
                // ("can't tell yet") far more often than a real posting
                // would. Same free, no-LLM heuristic as every Discover
                // card uses, not a new scoring method.
                const fitBucket = posting.title
                  ? computeSurfacedJobFitBucket(
                      profile,
                      { title: posting.title, location: null, description: null },
                      companySizeBandFor(posting.companyName)
                    )
                  : null
                const helpInfo = whoCanHelpFor(posting.id, posting.companyName)
                const helperNames = [...helpInfo.linkedContacts, ...helpInfo.suggestedContacts].map((c) => c.name)
                return (
                  <details key={posting.id} className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {posting.title || posting.companyName || 'Unknown role'}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {posting.title && posting.companyName ? `${posting.companyName} — ` : ''}
                          {status} · {posting.appliedAt?.toLocaleDateString()}
                        </p>
                        {helperNames.length > 0 && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            <span>Who can help: </span>
                            {helperNames.join(', ')}
                          </p>
                        )}
                      </div>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="space-y-3 px-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          {fitBucket && (
                            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {CARD_VERDICT_LABEL[cardVerdict(fitBucket)]}
                            </span>
                          )}
                          {openRoles > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {openRoles} open role{openRoles === 1 ? '' : 's'} in our job board
                            </p>
                          )}
                          {posting.url && (
                            <a
                              href={posting.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-primary underline underline-offset-4"
                            >
                              {posting.url}
                            </a>
                          )}
                        </div>
                        <form action={deleteJobPosting.bind(null, posting.id)}>
                          <SubmitButton variant="ghost" size="sm">
                            Remove
                          </SubmitButton>
                        </form>
                      </div>
                      <NextStepsToggle>
                        {!posting.declinedAt && !posting.offerReceivedAt && !posting.interviewLandedAt && (
                          <form action={markInterviewLanded.bind(null, posting.id)}>
                            <SubmitButton variant="outline" size="sm">
                              I got an interview
                            </SubmitButton>
                          </form>
                        )}
                        {!posting.declinedAt && !posting.offerReceivedAt && (
                          <>
                            <form action={markDeclined.bind(null, posting.id, 'COMPANY')}>
                              <SubmitButton variant="outline" size="sm">
                                They passed on me
                              </SubmitButton>
                            </form>
                            <form action={markDeclined.bind(null, posting.id, 'CANDIDATE')}>
                              <SubmitButton variant="outline" size="sm">
                                I passed on them
                              </SubmitButton>
                            </form>
                          </>
                        )}
                        {!posting.offerReceivedAt && !posting.declinedAt && (
                          <form action={markOfferReceived.bind(null, posting.id)}>
                            <SubmitButton variant="outline" size="sm">
                              Offer Received
                            </SubmitButton>
                          </form>
                        )}
                      </NextStepsToggle>
                      <JobDetailsEditor
                        initialTitle={posting.title}
                        initialUrl={posting.url}
                        companyName={posting.companyName}
                        action={updateApplicationDetails.bind(null, posting.id)}
                      />
                    </div>
                  </details>
                )
              }

              const helpInfo = whoCanHelpFor(posting.id, posting.companyName)
              const helperNames = [...helpInfo.linkedContacts, ...helpInfo.suggestedContacts].map((c) => c.name)
              return (
              <details key={posting.id} className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {posting.title || posting.companyName || posting.url}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {posting.title && posting.companyName ? `${posting.companyName} — ` : ''}
                      {posting.declinedAt
                        ? posting.declinedBy === 'CANDIDATE'
                          ? 'I passed'
                          : 'They passed'
                        : posting.offerReceivedAt
                          ? 'Offer received'
                          : posting.interviewLandedAt
                            ? 'Interview'
                            : posting.appliedAt
                              ? 'Applied'
                              : (STATUS_LABELS[posting.fetchStatus] ?? posting.fetchStatus)}
                    </p>
                    {helperNames.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        <span>Who can help: </span>
                        {helperNames.join(', ')}
                      </p>
                    )}
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-3 px-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      {posting.fitScore !== null && (
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                            FIT_SCORE_BADGE_CLASS[fitScoreToLabel(posting.fitScore)]
                          )}
                        >
                          {fitScoreToLabel(posting.fitScore)}
                        </span>
                      )}
                      <a
                        href={posting.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary underline underline-offset-4"
                      >
                        {posting.url}
                      </a>
                      <p className="text-sm text-muted-foreground">
                        {STATUS_LABELS[posting.fetchStatus] ?? posting.fetchStatus}
                      </p>
                      {posting.companyName && openRoles > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {openRoles} open role{openRoles === 1 ? '' : 's'} at {posting.companyName} in our job
                          board
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {(posting.fetchStatus === 'fetch_failed' || posting.fetchStatus === 'parse_failed') && (
                        <form action={retryJobFetch.bind(null, posting.id)}>
                          <SubmitButton variant="outline" size="sm">
                            Retry
                          </SubmitButton>
                        </form>
                      )}
                      <form action={deleteJobPosting.bind(null, posting.id)}>
                        <SubmitButton variant="ghost" size="sm">
                          Remove
                        </SubmitButton>
                      </form>
                    </div>
                  </div>

                  {posting.fetchError && (
                    <p className="text-sm text-destructive">{posting.fetchError}</p>
                  )}

                  {(posting.fetchStatus === 'fetch_failed' ||
                    posting.fetchStatus === 'parse_failed' ||
                    posting.fetchStatus === 'blocked') && (
                    <JobPostingTextFallback
                      jobPostingId={posting.id}
                      autoExpand={posting.fetchStatus === 'blocked'}
                    />
                  )}

                  {posting.fitScore !== null && (
                    <div className="space-y-1">
                      <p className={cn('text-sm font-medium', FIT_SCORE_TEXT_CLASS[fitScoreToLabel(posting.fitScore)])}>
                        {fitScoreToLabel(posting.fitScore)}
                      </p>
                      {posting.fitFeedback.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {posting.fitFeedback.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {posting.keywords.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Keywords to work into your resume
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {posting.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border border-border bg-off-white px-2.5 py-0.5 text-xs font-medium text-foreground"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(posting.tailoredBullets) && posting.tailoredBullets.length > 0 && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Bullets tailored to this posting</p>
                      <div className="space-y-3">
                        {(posting.tailoredBullets as unknown as TailoredBullet[]).map((bullet, i) => (
                          <div key={i} className="space-y-1 text-sm">
                            <p className="text-muted-foreground line-through decoration-destructive/50">
                              {bullet.original}
                            </p>
                            <p className="text-foreground">{bullet.tailored}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {posting.declinedAt && (
                    <p className="text-sm font-medium text-muted-foreground">
                      {posting.declinedBy === 'CANDIDATE' ? 'I passed' : 'They passed'}
                    </p>
                  )}

                  {posting.fitScore !== null && !posting.declinedAt && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {!posting.appliedAt && (
                        <MarkAppliedForm
                          jobPostingId={posting.id}
                          markApplied={markApplied}
                          isAtCurrentEmployer={companyMatchesCurrentEmployer(currentEmployerName, posting.companyName)}
                        />
                      )}
                      {!posting.coverLetter && (
                        <form action={generateCoverLetterAction.bind(null, posting.id)}>
                          <SubmitButton variant="outline" size="sm" pendingLabel="Drafting…">
                            Draft a cover letter
                          </SubmitButton>
                        </form>
                      )}
                      {(posting.appliedAt || posting.offerReceivedAt) && (
                        <NextStepsToggle>
                          {posting.appliedAt && !posting.interviewLandedAt && (
                            <>
                              <form action={markInterviewLanded.bind(null, posting.id)}>
                                <SubmitButton variant="outline" size="sm">
                                  I got an interview
                                </SubmitButton>
                              </form>
                              <form action={prepForPhoneScreen.bind(null, posting.id)}>
                                <SubmitButton variant="outline" size="sm">
                                  Prep for the phone screen →
                                </SubmitButton>
                              </form>
                            </>
                          )}
                          {posting.appliedAt && !posting.offerReceivedAt && (
                            <form action={markOfferReceived.bind(null, posting.id)}>
                              <SubmitButton variant="outline" size="sm">
                                Offer Received
                              </SubmitButton>
                            </form>
                          )}
                          {posting.appliedAt && !posting.offerReceivedAt && (
                            <>
                              <form action={markDeclined.bind(null, posting.id, 'COMPANY')}>
                                <SubmitButton variant="outline" size="sm">
                                  They passed on me
                                </SubmitButton>
                              </form>
                              <form action={markDeclined.bind(null, posting.id, 'CANDIDATE')}>
                                <SubmitButton variant="outline" size="sm">
                                  I passed on them
                                </SubmitButton>
                              </form>
                            </>
                          )}
                          {posting.offerReceivedAt && (
                            <Button nativeButton={false} render={<Link href="/dashboard/got-hired" />} size="sm">
                              Offer Accepted
                            </Button>
                          )}
                        </NextStepsToggle>
                      )}
                    </div>
                  )}

                  {posting.fitScore !== null && !posting.appliedAt && (
                    <p className="text-xs text-muted-foreground">
                      Mark it Applied once you&apos;ve submitted your application to unlock
                      interview prep.
                    </p>
                  )}

                  {posting.coverLetterError && (
                    <p className="text-sm text-destructive">{posting.coverLetterError}</p>
                  )}

                  {posting.coverLetter && (
                    <details className="group rounded-md border border-border p-3">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                        Cover letter
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {posting.coverLetter}
                      </p>
                    </details>
                  )}

                  {posting.interviewLandedAt && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Interview prep</p>
                      {posting.interviewPrepError && (
                        <p className="text-sm text-destructive">{posting.interviewPrepError}</p>
                      )}
                      {posting.interviewPrep && (
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Likely questions</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.interviewPrep as unknown as InterviewPrep).likelyQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Talking points</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.interviewPrep as unknown as InterviewPrep).talkingPoints.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Questions to ask them</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.interviewPrep as unknown as InterviewPrep).questionsToAsk.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      {!posting.interviewCompleteAt && (
                        <form action={markInterviewComplete.bind(null, posting.id)} className="pt-1">
                          <SubmitButton variant="outline" size="sm">
                            Interview complete
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  )}

                  {posting.interviewCompleteAt && (
                    <ThankYouNoteCard
                      jobPostingId={posting.id}
                      note={posting.thankYouNote}
                      error={posting.thankYouError}
                      sentAt={posting.thankYouSentAt}
                    />
                  )}

                  {posting.offerReceivedAt && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Negotiation advice</p>
                      {posting.negotiationAdviceError && (
                        <p className="text-sm text-destructive">{posting.negotiationAdviceError}</p>
                      )}
                      {posting.negotiationAdvice && (
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">Opening script</p>
                            <p>{(posting.negotiationAdvice as unknown as NegotiationAdvice).scriptOpening}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Talking points</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.negotiationAdvice as unknown as NegotiationAdvice).talkingPoints.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Also consider</p>
                            <ul className="list-disc space-y-1 pl-5">
                              {(posting.negotiationAdvice as unknown as NegotiationAdvice).considerations.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <NegotiationPracticeTab jobPostingId={posting.id} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
              )
            })}
            </ShowMoreList>
            </div>

            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground">
                Add a job manually (paste a URL for fit-check + cover letter tools)
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {atCap ? (
                  <p className="text-sm text-muted-foreground">
                    You have 5 job postings tracked — remove one below to add another.
                  </p>
                ) : (
                  <JobUrlForm />
                )}
              </div>
            </details>
          </div>
        )}
        {jobPostings.length === 0 && (
          <details className="group rounded-lg border border-border p-3 text-sm">
            <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium text-foreground">
              Add a job manually (paste a URL for fit-check + cover letter tools)
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 space-y-3">
              <JobUrlForm />
            </div>
          </details>
        )}

        <div id="interview-tracking" className="scroll-mt-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Interview Tracker</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every interview you&apos;ve landed, in one place — plus a fast way to log a new one
              and jump straight to prep.
            </p>
          </div>

          {interviewingPostings.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {interviewingPostings.map((posting) => (
                <div key={posting.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {posting.companyName ?? 'Unknown company'}
                      {posting.title ? ` — ${posting.title}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Interview landed {posting.interviewLandedAt!.toLocaleDateString()}
                      {posting.interviewCompleteAt ? ' · Completed' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={prepForPhoneScreen.bind(null, posting.id)}>
                      <SubmitButton variant="outline" size="sm">
                        Interview prep →
                      </SubmitButton>
                    </form>
                    {!posting.interviewCompleteAt && (
                      <form action={markInterviewComplete.bind(null, posting.id)}>
                        <SubmitButton variant="outline" size="sm">
                          Mark complete
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Got an interview?</p>

            <InterviewJobPicker
              eligibleForInterview={eligibleForInterview}
              atCap={atCap}
              markInterviewLandedFromForm={markInterviewLandedFromForm}
              addInterviewJob={addInterviewJob}
            />

            <Link
              href="/dashboard/interview-prep"
              className="block text-sm font-medium text-primary underline underline-offset-4"
            >
              Just want interview prep, no specific job? →
            </Link>
          </div>
        </div>
        </div>
      </div>


      <div id="company-tracker" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Company Tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name companies you&apos;d actually want to work for and watch for openings there,
            instead of only reacting to what&apos;s already posted. Adding companies also helps us
            tailor recommendations and train our matching system to understand what you&apos;re
            looking for.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <CompanyWatchlistForm />
            <CompanyWatchlist entries={watchlistView} />
          </CardContent>
        </Card>
      </div>


      <div id="mock-interview" className="scroll-mt-4 space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Complete a Mock Interview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Practicing out loud before the real thing is what actually builds confidence — reading
            a good answer isn&apos;t the same as saying one. This is detected automatically the
            moment you answer a practice or tough interview question, not a box you check yourself.
          </p>
        </div>
        <Link
          href="/dashboard/interview-prep"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Go to Interview Prep →
        </Link>
      </div>

      </ShowMore>
      )}

      {onBoard && show('resources') && <FindResourcesSection profile={profile} />}

      {/* The guides sit in Resources, so the other parts do not repeat them below. */}
      {!(onBoard && (part === 'resources' || part === 'unposted' || part === 'independent')) && (
        <GuideCallout pageSlot="find-my-job" currentJobStatus={profile.currentJobStatus} />
      )}
    </>
  )
}
