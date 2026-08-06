import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchAdzunaJobListings, type AdzunaListing } from '@/lib/market/adzuna'
import { searchAtsJobs } from '@/lib/market/ats-jobs'
import { searchJSearchJobs } from '@/lib/market/jsearch'
import { getAnthropicClient } from '@/lib/anthropic'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { isVagueTargetRole } from '@/lib/constants/onboarding'

const SURFACE_LIMIT = 10
// Same gate for both "is there enough signal to write a real pattern" and
// "is there enough signal to unlock the Dossier's pattern section" — see
// isDossierComplete in dossier-sections.ts, which mirrors this threshold
// with its own cheap existence check rather than calling generateJobPattern.
export const MIN_SIGNALS_FOR_PATTERN = 5

// A vague/no-direction targetRoleType (e.g. "flexible", "open") makes for a
// generic Adzuna text query that surfaces irrelevant gig-economy noise (e.g.
// "Uber driver") — fall back to the more concrete primaryFunction in that
// case rather than searching on the vague text directly.
function buildSearchQuery(candidate: { targetRoleType: string | null; primaryFunction: string | null }): string | null {
  if (candidate.targetRoleType && !isVagueTargetRole(candidate.targetRoleType)) {
    return candidate.targetRoleType
  }
  return candidate.primaryFunction || candidate.targetRoleType || null
}

// Supplementary any-of terms layered onto the core query via what_or — resume
// keywords and target industry sharpen relevance without the all-must-match
// risk of folding them into `what` directly.
function buildSupplementaryKeywords(candidate: { resumeKeywords: string[]; targetIndustries: string[] }): string[] {
  return [...candidate.resumeKeywords.slice(0, 3), ...candidate.targetIndustries.slice(0, 1)]
}

// Pulls fresh listings and stores any not already surfaced to this
// candidate — surfaced to learn from reactions, not to encourage mass
// applying (no apply button, no application tracking here).
//
// Waterfall, cheapest/highest-quality first: direct feeds from established
// companies on Greenhouse/Lever/Ashby, then JSearch (broad aggregator,
// capped at its 200 free calls/month), then Adzuna last — Adzuna has the
// broadest coverage but the least reliably relevant listings of the three,
// so it only fills whatever gap the first two didn't.
export async function surfaceNewJobs(candidateId: string, limit: number = SURFACE_LIMIT): Promise<number> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const query = buildSearchQuery(candidate)
  if (!query) return 0

  let listings: AdzunaListing[] = await searchAtsJobs(query, limit, candidateId, {
    primaryFunction: candidate.primaryFunction,
    secondaryFunction: candidate.secondaryFunction,
  })

  if (listings.length < limit) {
    const jsearchListings = await searchJSearchJobs(
      query,
      candidate.currentCity,
      limit - listings.length
    )
    listings = [...listings, ...jsearchListings]
  }

  if (listings.length < limit) {
    const whatOr = buildSupplementaryKeywords(candidate)
    const adzunaListings = await searchAdzunaJobListings(
      query,
      candidate.currentCity,
      limit - listings.length,
      { whatOr: whatOr.length > 0 ? whatOr : undefined, salaryMin: candidate.targetCompMin ?? undefined }
    )
    listings = [...listings, ...adzunaListings]
  }

  if (listings.length === 0) return 0

  const existingUrls = new Set(
    (await prisma.surfacedJob.findMany({ where: { candidateId }, select: { url: true } })).map((j) => j.url)
  )
  const seenInThisBatch = new Set<string>()
  const newListings = listings.filter((l) => {
    if (existingUrls.has(l.url) || seenInThisBatch.has(l.url)) return false
    seenInThisBatch.add(l.url)
    return true
  })
  if (newListings.length === 0) return 0

  await prisma.surfacedJob.createMany({
    data: newListings.map((l) => ({
      candidateId,
      title: l.title,
      companyName: l.companyName,
      location: l.location,
      url: l.url,
      description: l.description,
    })),
    skipDuplicates: true,
  })
  return newListings.length
}

export interface JobPatternResult {
  summary: string | null
  signalCount: number
}

// "What's My Pattern" — reads both halves of a candidate's job activity,
// not just the automated search-partner matches they've swiped on: jobs
// they added and applied to themselves carry just as much signal about
// what they actually want, and were being silently ignored before this.
export async function generateJobPattern(candidateId: string): Promise<JobPatternResult> {
  const [reactedJobs, jobPostings] = await Promise.all([
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: { not: null } },
      orderBy: { reactedAt: 'desc' },
      take: 30,
    }),
    prisma.jobPosting.findMany({
      where: { candidateId, OR: [{ appliedAt: { not: null } }, { fitScore: { not: null } }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const signalCount = reactedJobs.length + jobPostings.length
  if (signalCount < MIN_SIGNALS_FOR_PATTERN) return { summary: null, signalCount }

  const lines = [
    ...reactedJobs.map(
      (j) =>
        `"${j.title}"${j.companyName ? ` at ${j.companyName}` : ''}: ${j.reaction}${j.reactionReason ? ` (${j.reactionReason})` : ''}`
    ),
    ...jobPostings.map((p) => {
      const title = p.title ?? 'an unnamed role'
      const company = p.companyName ? ` at ${p.companyName}` : ''
      const action = p.appliedAt ? 'applied' : 'reviewed for fit'
      const fit = p.fitScore !== null ? `, fit score ${p.fitScore}/100` : ''
      return `"${title}"${company}: ${action}${fit}`
    }),
  ]
  const summaryInput = lines.join('\n')

  const prompt = `${VICTORIA_VOICE_PROMPT}

Here is this candidate's job search activity — reactions to jobs surfaced to them, plus jobs they added and applied to themselves, most recent first:

${summaryInput}

Write 2-4 sentences identifying the real pattern in what they're rejecting vs. showing interest in vs. actually applying to, and one concrete, specific recommendation for adjusting their target based on it. Reference actual reasons/roles/companies from the data above — never invent a pattern that isn't there. If there's genuinely no clear pattern yet, say so honestly instead of forcing one.`

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 800,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    return { summary: text || null, signalCount }
  } catch (error) {
    console.error('Failed to generate job-search pattern summary for candidate', candidateId, error)
    return { summary: null, signalCount }
  }
}
