import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatch } from '@/lib/text/org-name-match'

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
// postings a non-A-List candidate can't open are counted in lockedCount but
// their details are never included in visiblePostings, since this shape is
// sent straight to the client component.
export interface WatchlistEntryView {
  id: string
  companyName: string
  newPostingCount: number
  visiblePostings: WatchlistPosting[]
  lockedCount: number
}

// Active NC Job Board postings only (archived/rejected/excluded/expired
// rows never count) — the same eligibility filter find-my-job/page.tsx's
// main boardPostings query uses, so "N open in our system" here never
// disagrees with what Discover actually shows. This dataset is bounded by
// the curated ATS company list plus admin/employer/recruiter submissions —
// small enough to fetch in full and match in JS against each candidate's
// watchlist, rather than needing a normalized column on ExclusiveJobPosting
// itself.
async function getActivePostings(): Promise<(WatchlistPosting & { audienceTier: string })[]> {
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
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getWatchlistView(candidateId: string, isAList: boolean): Promise<WatchlistEntryView[]> {
  const [entries, postings] = await Promise.all([
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
    getActivePostings(),
  ])

  return entries.map((entry) => {
    const matches = postings.filter((p) => orgNamesMatch(p.companyName, entry.companyName))
    // A_LIST_ONLY postings are real "in our system" jobs, just not ones
    // this candidate can open yet — counted, never detailed, unless the
    // candidate is actually A-List.
    const visible = matches.filter((p) => isAList || p.audienceTier !== 'A_LIST_ONLY')
    const newPostingCount = matches.filter((p) => p.createdAt > entry.lastViewedAt).length
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
      lockedCount: matches.length - visible.length,
    }
  })
}

export async function addCompanyToWatchlist(
  candidateId: string,
  companyName: string
): Promise<{ error?: string }> {
  const trimmed = companyName.trim()
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
