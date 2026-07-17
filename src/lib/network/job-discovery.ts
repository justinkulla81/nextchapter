import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchAdzunaJobListings, type AdzunaListing } from '@/lib/market/adzuna'
import { searchAtsJobs } from '@/lib/market/ats-jobs'
import { searchJSearchJobs } from '@/lib/market/jsearch'
import { getAnthropicClient } from '@/lib/anthropic'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { isVagueTargetRole } from '@/lib/constants/onboarding'

const SURFACE_LIMIT = 10
const MIN_REACTIONS_FOR_SUMMARY = 3

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
export async function surfaceNewJobs(candidateId: string): Promise<number> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const query = buildSearchQuery(candidate)
  if (!query) return 0

  let listings: AdzunaListing[] = await searchAtsJobs(query, SURFACE_LIMIT, candidateId)

  if (listings.length < SURFACE_LIMIT) {
    const jsearchListings = await searchJSearchJobs(
      query,
      candidate.currentCity,
      SURFACE_LIMIT - listings.length
    )
    listings = [...listings, ...jsearchListings]
  }

  if (listings.length < SURFACE_LIMIT) {
    const whatOr = buildSupplementaryKeywords(candidate)
    const adzunaListings = await searchAdzunaJobListings(
      query,
      candidate.currentCity,
      SURFACE_LIMIT - listings.length,
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

export async function generateReactionSummary(candidateId: string): Promise<string | null> {
  const reactedJobs = await prisma.surfacedJob.findMany({
    where: { candidateId, reaction: { not: null } },
    orderBy: { reactedAt: 'desc' },
    take: 30,
  })
  if (reactedJobs.length < MIN_REACTIONS_FOR_SUMMARY) return null

  const summary = reactedJobs
    .map((j) => `"${j.title}"${j.companyName ? ` at ${j.companyName}` : ''}: ${j.reaction}${j.reactionReason ? ` (${j.reactionReason})` : ''}`)
    .join('\n')

  const prompt = `${VICTORIA_VOICE_PROMPT}

Here are this candidate's reactions to jobs surfaced to them, most recent first:

${summary}

Write 2-4 sentences identifying the real pattern in what they're rejecting vs. showing interest in, and one concrete, specific recommendation for adjusting their target based on it. Reference actual reasons/roles from the data above — never invent a pattern that isn't there. If there's genuinely no clear pattern yet, say so honestly instead of forcing one.`

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
  return text || null
}
