import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'

const PROMPT_PREFIX = `Write a "Core Narrative Statement" for this candidate — 2-3 sentences they can say or write anywhere (LinkedIn, a resume summary, out loud in an interview) that captures who they are professionally and what they're looking for next. Ground every claim in their real background below — never invent achievements, employers, or skills that aren't there. First person, confident, specific (not generic buzzwords like "results-driven" or "team player"). Plain prose only, no markdown, no labels — just the statement itself.

HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, this statement is the single most important tool for translating their real background into the target function/industry's language — don't just restate their past title. Explicitly bridge past achievements to the new direction (e.g. name the transferable skill or pattern of results that applies), so a stranger reading it understands why this background is relevant to where they're headed next, not just where they've been.

Candidate profile:
`

async function draftCoreStatement(candidateId: string, scenarioContext?: string): Promise<string | null> {
  const [candidate, levelRank] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: { workHistory: true },
    }),
    getCandidateLevelRank(candidateId),
  ])

  const summary = `
Name: ${candidate.firstName ?? ''}
Target role: ${candidate.targetRoleType ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Calibrated seniority context (internal signal — informs tone and targeting only; never reference this line, its score, or its wording in your output): ${levelRank.label ?? 'not available'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Target function: ${candidate.targetFunction ?? 'not specified'}
Considering a pivot to a different function/industry: ${candidate.isPivoting ? 'yes' : 'no'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`).join('; ') || 'not specified'}
${candidate.activeJobDescription ? `Job posting they're preparing for: ${candidate.activeJobDescription}` : ''}
${scenarioContext ? `\nThis particular narrative should be framed specifically around: ${scenarioContext}` : ''}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      // max_tokens is a shared budget covering both adaptive-thinking tokens
      // and the final text — 500 left too little room after thinking, so
      // the 2-3 sentence statement was getting cut off mid-word before the
      // model finished (see narrative regeneration bug, Batch 25).
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${summary}` }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    return text || null
  } catch (error) {
    console.error('Failed to draft core narrative statement for candidate', candidateId, error)
    return null
  }
}

// Every candidate has one implicit "default" narrative — the earliest-created
// row for that candidateId — which all single-narrative consumers (interview
// prep, guides, profile share) read via `findFirst({ orderBy: { generatedAt: 'asc' } })`.
// `narrativeId` targets a specific (e.g. additional named-scenario) row instead.
export async function generateCoreNarrative(
  candidateId: string,
  narrativeId?: string,
  scenarioContext?: string
): Promise<void> {
  const text = await draftCoreStatement(candidateId, scenarioContext)
  if (!text) return

  const targetId =
    narrativeId ??
    (
      await prisma.candidateNarrative.findFirst({
        where: { candidateId },
        orderBy: { generatedAt: 'asc' },
        select: { id: true },
      })
    )?.id

  if (targetId) {
    await prisma.candidateNarrative.update({ where: { id: targetId }, data: { coreStatement: text } })
  } else {
    await prisma.candidateNarrative.create({ data: { candidateId, coreStatement: text, adaptations: {} } })
  }
}

// Always creates a new row (a named scenario narrative), never touches the default.
export async function createNamedNarrative(
  candidateId: string,
  label: string,
  scenarioContext?: string
): Promise<string | null> {
  const text = await draftCoreStatement(candidateId, scenarioContext)
  if (!text) return null

  const created = await prisma.candidateNarrative.create({
    data: { candidateId, label, coreStatement: text, adaptations: {} },
  })
  return created.id
}
