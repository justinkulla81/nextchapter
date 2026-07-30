import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { fetchSubstack } from '@/lib/network/fetch-substack'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'

const critiqueSchema = z.object({
  relevanceToBackground: z.string(),
  noveltyOfIdeas: z.string(),
  cadence: z.string(),
  overallAssessment: z.string(),
})

const PROMPT = `You are giving a candidate honest, specific feedback on their existing Substack/newsletter, to help their job search and personal brand. Be critical where the content warrants it — this is not a pep talk. Assess:

1. Relevance to background/expertise: does the writing draw on real, specific experience from their background, or is it generic and disconnected from what they're actually known for?
2. Novelty of ideas: are they saying anything genuinely their own, or mostly repeating common takes?
3. Cadence: based on the page content, note anything you can actually observe about posting frequency/consistency (dates, "weekly", archive density, etc.). If the scraped content doesn't give you enough to judge cadence, say so plainly rather than guessing a schedule.
4. Overall assessment: 2-3 sentences, direct, naming the single biggest thing to improve.

Candidate background:
`

export async function analyzeSubstack(candidateId: string, url: string): Promise<void> {
  const [candidate, result] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
    fetchSubstack(url),
  ])
  if (result.status !== 'success' || !result.text) {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        substackUrl: url,
        substackCritique: {
          relevanceToBackground: '',
          noveltyOfIdeas: '',
          cadence: '',
          overallAssessment: result.error ?? 'Could not read that page.',
        },
        substackAnalyzedAt: new Date(),
      },
    })
    return
  }

  const levelRank = await getCandidateLevelRank(candidateId)

  const candidateSummary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Calibrated seniority context (internal signal — informs tone and targeting only; never reference this line, its score, or its wording in your output): ${levelRank.label ?? 'not available'}
Known for: ${candidate.knownFor ?? 'not specified'}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(critiqueSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: `${PROMPT}${candidateSummary}\n\nScraped Substack page content:\n${result.text}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output
    if (!data) return

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        substackUrl: url,
        substackCritique: data,
        substackAnalyzedAt: new Date(),
      },
    })
  } catch {
    // Analysis failure is non-fatal — the URL is still saved, just without a critique.
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { substackUrl: url, substackAnalyzedAt: new Date() },
    })
  }
}
