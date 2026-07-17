import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchAdzunaJobListings } from '@/lib/market/adzuna'
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

// Pulls fresh listings from Adzuna and stores any not already surfaced to
// this candidate — surfaced to learn from reactions, not to encourage mass
// applying (no apply button, no application tracking here).
export async function surfaceNewJobs(candidateId: string): Promise<number> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const query = buildSearchQuery(candidate)
  if (!query) return 0

  const listings = await searchAdzunaJobListings(query, candidate.currentCity, SURFACE_LIMIT)
  if (listings.length === 0) return 0

  const existingUrls = new Set(
    (await prisma.surfacedJob.findMany({ where: { candidateId }, select: { url: true } })).map((j) => j.url)
  )
  const newListings = listings.filter((l) => !existingUrls.has(l.url))
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
