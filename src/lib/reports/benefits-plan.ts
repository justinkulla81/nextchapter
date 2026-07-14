import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

const PROMPT_PREFIX = `A candidate in a job search answered a question about the biggest financial pressure they're under right now. Write a short, personalized, step-by-step action plan (4-6 numbered steps) responding directly to what they said. Ground every step in the general categories below — unemployment insurance, COBRA/marketplace health coverage, WIOA-funded training, and budgeting/runway — but do not invent state-specific dollar amounts, deadlines, or eligibility rules you don't actually know; point them to the right resource or office to get the real numbers instead. Plain, direct, practical tone — no false reassurance, no generic "you've got this" filler.

Categories to draw from:
- Unemployment insurance: file through their state (not a national site); most laid-off (not fired for cause) candidates qualify.
- Health insurance bridge: COBRA (keep employer plan, full premium) vs. Healthcare.gov marketplace (usually cheaper; losing job coverage triggers a Special Enrollment Period).
- WIOA-funded training: free occupational training via the local American Job Center; broad eligibility, worth checking regardless of assumptions.
- Budgeting/runway: essential expenses ÷ (savings + expected unemployment benefits) = real runway; a free nonprofit credit counselor (NFCC) session before big financial decisions.

`

export async function generateBenefitsPlan(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })

  if (!candidate.benefitsUnlockAnswer) return

  const candidateSummary = `
Current job status: ${candidate.currentJobStatus ?? 'not specified'}
Gap duration: ${candidate.gapDuration ?? 'not specified'}
Target role: ${candidate.targetRoleType ?? 'not specified'}
Location: ${candidate.currentCity ?? 'not specified'}${candidate.currentState ? `, ${candidate.currentState}` : ''}

Their stated financial pressure: "${candidate.benefitsUnlockAnswer}"
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${candidateSummary}` }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    if (!text) return

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { benefitsActionPlan: text, benefitsActionPlanGeneratedAt: new Date() },
    })
  } catch {
    // Non-fatal — the static resource content below still renders without a plan.
  }
}
