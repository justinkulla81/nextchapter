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

export interface WatchlistEntryWithCount {
  id: string
  companyName: string
  createdAt: Date
  lastViewedAt: Date
  newPostingCount: number
}

// Active NC Job Board postings only (archived/rejected rows never count as
// "new"). This dataset is bounded by the curated ATS company list plus
// admin/employer/recruiter submissions — small enough to fetch in full and
// match in JS against each candidate's watchlist, rather than needing a
// normalized column on ExclusiveJobPosting itself.
async function getActivePostings(): Promise<WatchlistPosting[]> {
  return prisma.exclusiveJobPosting.findMany({
    where: { archivedAt: null, status: 'approved' },
    select: { id: true, title: true, companyName: true, location: true, url: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getWatchlistWithCounts(candidateId: string): Promise<WatchlistEntryWithCount[]> {
  const [entries, postings] = await Promise.all([
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
    getActivePostings(),
  ])

  return entries.map((entry) => {
    const newPostingCount = postings.filter(
      (p) => orgNamesMatch(p.companyName, entry.companyName) && p.createdAt > entry.lastViewedAt
    ).length
    return {
      id: entry.id,
      companyName: entry.companyName,
      createdAt: entry.createdAt,
      lastViewedAt: entry.lastViewedAt,
      newPostingCount,
    }
  })
}

export async function getWatchlistPostings(candidateId: string): Promise<WatchlistPosting[]> {
  const entries = await prisma.companyWatchlistEntry.findMany({ where: { candidateId } })
  if (entries.length === 0) return []
  const postings = await getActivePostings()
  return postings.filter((p) => entries.some((e) => orgNamesMatch(p.companyName, e.companyName)))
}

// Total unseen-new-posting count across the whole watchlist — the number
// shown as the nav badge, same convention as newJobMatchesCount.
export async function getWatchlistNotificationCount(candidateId: string): Promise<number> {
  const rows = await getWatchlistWithCounts(candidateId)
  return rows.reduce((sum, r) => sum + r.newPostingCount, 0)
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
