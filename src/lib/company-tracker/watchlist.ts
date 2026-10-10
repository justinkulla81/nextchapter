import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatch, fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import type { PageContentView } from '@/lib/dashboard/page-content'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { getLikelyOpeningsForCompanies, type CompanyLikelyOpening } from '@/lib/likely-openings/for-companies'
import { getTopHiringCompanies, isAdzunaInsightsEnabled, memberMarketRole, resolveState } from '@/lib/market/adzuna-insights'

export interface WatchlistPosting {
  id: string
  title: string
  companyName: string
  location: string | null
  url: string
  createdAt: Date
}

// One row per watched company, consolidated for the single-list Company
// Tracker UI — company name, total count "in our system" (visible to this
// candidate), and the actual postings to expand into on click. A_LIST_ONLY
// postings a non-Candidate+ candidate can't open are counted in lockedCount
// but their details are never included in visiblePostings, since this shape
// is sent straight to the client component.
export interface WatchlistEntryView {
  id: string
  companyName: string
  newPostingCount: number
  visiblePostings: WatchlistPosting[]
  lockedCount: number
  // SEC filings suggesting a senior role is about to open here (officer
  // departure, new CEO, big raise) — see src/lib/likely-openings/.
  likelyOpenings: CompanyLikelyOpening[]
  // Set when Adzuna ranks this company among the top 5 advertisers for the
  // member's target role (their state first, then nationwide).
  topHirer: WatchlistTopHirer | null
}

export interface WatchlistTopHirer {
  rank: number
  openCount: number
  role: string
  place: string // state name or "the US"
}

// Cache-only read (onMiss: 'background') so the Jobs page never waits on
// Adzuna; a cold cache fills after the response and shows next visit.
async function getTopHirerMatcher(candidateId: string): Promise<(companyName: string) => WatchlistTopHirer | null> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { targetRoleType: true, targetFunction: true, primaryFunction: true, currentState: true },
  })
  const role = candidate ? memberMarketRole(candidate) : null
  if (!role) return () => null
  const state = resolveState(candidate?.currentState)
  const [local, national] = await Promise.all([
    state ? getTopHiringCompanies({ role, state }, { onMiss: 'background' }) : Promise.resolve(null),
    getTopHiringCompanies({ role, state: null }, { onMiss: 'background' }),
  ])
  const boards = [
    { place: state ?? 'the US', companies: local?.data?.companies ?? [] },
    { place: 'the US', companies: national.data?.companies ?? [] },
  ]
  return (companyName) => {
    for (const board of boards) {
      const i = board.companies.findIndex((c) => orgNamesMatch(c.name, companyName))
      if (i >= 0) return { rank: i + 1, openCount: board.companies[i].count, role, place: board.place }
    }
    return null
  }
}

// Active NC Job Board postings only (archived/rejected/excluded/expired
// rows never count) — the same eligibility filter find-my-job/page.tsx's
// main boardPostings query uses, so "N open in our system" here never
// disagrees with what Discover actually shows. This dataset is bounded by
// the curated ATS company list plus admin/employer/recruiter submissions —
// small enough to fetch in full and match in JS against each candidate's
// watchlist, rather than needing a normalized column on ExclusiveJobPosting
// itself.
async function getActivePostings(): Promise<(WatchlistPosting & { audienceTier: string; source: string })[]> {
  return prisma.exclusiveJobPosting.findMany({
    where: {
      archivedAt: null,
      status: 'approved',
      distribution: { not: 'EXCLUDED' },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      title: true,
      companyName: true,
      location: true,
      url: true,
      createdAt: true,
      audienceTier: true,
      source: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

// This candidate's own automated-search-partner matches (see
// surfaceNewJobs) — a real "in our system" signal just like the job board,
// and the one actually shown on the Jobs page's combined recommendations
// list. Without this, a company could show up there from a SurfacedJob
// match while the watchlist still says "0 jobs" for it, since the board
// query above only ever sees ExclusiveJobPosting rows. Not Candidate+ gated
// — SurfacedJob has no audienceTier concept, these are just genuinely
// matched to this specific candidate.
async function getSurfacedJobPostings(candidateId: string): Promise<WatchlistPosting[]> {
  const jobs = await prisma.surfacedJob.findMany({
    where: { candidateId, companyName: { not: null } },
    select: { id: true, title: true, companyName: true, location: true, url: true, surfacedAt: true },
  })
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: j.companyName!,
    location: j.location,
    url: j.url,
    createdAt: j.surfacedAt,
  }))
}

// Shared match/new-count computation, reused by getWatchlistView (which
// additionally applies Candidate+ gating to decide what's visible) and
// getWatchlistAlertContent (which only cares whether *anything* new landed,
// not whether this candidate can open it yet — see that function for why
// Candidate+ status doesn't matter there).
async function matchWatchlistEntries(candidateId: string) {
  const [entries, boardPostings, surfacedPostings] = await Promise.all([
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
    getActivePostings(),
    getSurfacedJobPostings(candidateId),
  ])

  return entries.map((entry) => {
    const boardMatches = boardPostings.filter((p) => orgNamesMatch(p.companyName, entry.companyName))
    const surfacedMatches = surfacedPostings.filter((p) => orgNamesMatch(p.companyName, entry.companyName))
    const allMatches = [...boardMatches, ...surfacedMatches]
    const newPostingCount = allMatches.filter((p) => p.createdAt > entry.lastViewedAt).length
    return { entry, boardMatches, surfacedMatches, newPostingCount }
  })
}

export async function getWatchlistView(candidateId: string, isCandidatePlus: boolean): Promise<WatchlistEntryView[]> {
  const matches = await matchWatchlistEntries(candidateId)
  // Never let a signals lookup break the tracker itself.
  const signals = await getLikelyOpeningsForCompanies(matches.map((m) => m.entry.companyName)).catch(
    () => new Map<string, CompanyLikelyOpening[]>()
  )
  const topHirerFor =
    matches.length > 0 && isAdzunaInsightsEnabled() ? await getTopHirerMatcher(candidateId).catch(() => () => null) : () => null

  return matches.map(({ entry, boardMatches, surfacedMatches, newPostingCount }) => {
    // A_LIST_ONLY postings are real "in our system" jobs, just not ones
    // this candidate can open yet — counted, never detailed, unless the
    // candidate is actually Candidate+.
    const visibleBoard = boardMatches.filter((p) => !isBoardPostingLockedForViewer(p, isCandidatePlus))
    const visible = [...visibleBoard, ...surfacedMatches]
    return {
      id: entry.id,
      companyName: entry.companyName,
      newPostingCount,
      visiblePostings: visible.map(({ id, title, companyName, location, url, createdAt }) => ({
        id,
        title,
        companyName,
        location,
        url,
        createdAt,
      })),
      lockedCount: boardMatches.length - visibleBoard.length,
      likelyOpenings: signals.get(entry.companyName) ?? [],
      topHirer: topHirerFor(entry.companyName),
    }
  })
}

// Computed "Daily Message" for the dashboard/find-my-job header — takes
// priority over the admin-authored rotation for that candidate for the day
// (see getPageBoxContent's dynamicOverride param). Deliberately skips the
// Candidate+ visibility gate getWatchlistView applies: this is just "heads
// up, something landed," not the postings themselves, so it's fine to
// mention a company by name even for a locked posting a non-Candidate+
// candidate can't open yet — the Company Tracker section on find-my-job
// explains the lock.
export async function getWatchlistAlertContent(candidateId: string): Promise<PageContentView | null> {
  const matches = await matchWatchlistEntries(candidateId)
  const withNew = matches.filter((m) => m.newPostingCount > 0)
  if (withNew.length === 0) return null

  const totalNew = withNew.reduce((sum, m) => sum + m.newPostingCount, 0)
  const title =
    withNew.length === 1
      ? `${totalNew} new job${totalNew === 1 ? '' : 's'} at ${withNew[0].entry.companyName}`
      : `New jobs at ${withNew.length} companies you're watching`

  return {
    id: 'watchlist-new-jobs',
    title,
    leadIn: null,
    bullets: withNew.map(
      ({ entry, newPostingCount }) => `${entry.companyName}: ${newPostingCount} new job${newPostingCount === 1 ? '' : 's'}`
    ),
    footer: 'Check your watchlist on the Jobs page for details.',
    videoProvider: null,
    videoUrl: null,
    useInlineEmbed: false,
    isPinned: true,
  }
}

export async function addCompanyToWatchlist(
  candidateId: string,
  companyName: string
): Promise<{ error?: string }> {
  const trimmed = fixAllCapsCompanyName(companyName.trim())
  if (!trimmed) return { error: 'Enter a company name.' }

  const normalized = normalizeOrgName(trimmed)
  if (!normalized) return { error: 'Enter a valid company name.' }

  const existing = await prisma.companyWatchlistEntry.findUnique({
    where: { candidateId_companyNameNormalized: { candidateId, companyNameNormalized: normalized } },
  })
  if (existing) return { error: `${trimmed} is already on your watchlist.` }

  await prisma.companyWatchlistEntry.create({
    data: { candidateId, companyName: trimmed, companyNameNormalized: normalized },
  })
  return {}
}

export async function removeCompanyFromWatchlist(candidateId: string, entryId: string): Promise<void> {
  await prisma.companyWatchlistEntry.deleteMany({ where: { id: entryId, candidateId } })
}

export async function markWatchlistViewed(candidateId: string): Promise<void> {
  await prisma.companyWatchlistEntry.updateMany({ where: { candidateId }, data: { lastViewedAt: new Date() } })
}
