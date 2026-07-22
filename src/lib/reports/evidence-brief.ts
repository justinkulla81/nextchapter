import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { selectDisplayedWorkHistory, sanitizeRoleTitle } from '@/lib/work-history/sanitize'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'
import { CHARACTER_SIGNAL_MIN_REFERENCES, characterSignalsUnlocked, type EvidenceType } from '@/lib/reports/evidence-type'

export interface EvidenceBrief {
  identityRevealed: boolean
  candidateName: string
  workHistory: { companyName: string; roleTitle: string; startDate: Date; endDate: Date | null; isCurrent: boolean; keyAchievement: string | null }[]
  workSamples: { title: string; description: string; outcome: string | null }[]
  effortSummaryLines: string[]
  whyTheyMightFit: string | null
  whyTheyMightFitEvidenceType: EvidenceType
  gaps: string[]
  questionsWorthAsking: string[]
  availability: {
    statusLabel: string | null
    targetRoleType: string | null
    primaryFunction: string | null
    highestLevelReached: string | null
  }
  approvalPending: boolean
}

async function generateFitNarrative(input: {
  candidateFacts: string
  roleFacts: string | null
}): Promise<string | null> {
  try {
    const client = getAnthropicClient()
    const prompt = `You are helping a hiring manager understand why a candidate might fit a role. Write 2-3 sentences of grounded narrative — strictly based on the facts below, never inventing claims not present in the facts.

Candidate facts:
${input.candidateFacts}

${input.roleFacts ? `Role requirements:\n${input.roleFacts}` : 'No specific role requirements provided — write generally about their strongest evidence.'}`

    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    return text.trim() || null
  } catch (error) {
    console.error('Failed to generate fit narrative for evidence brief', error)
    return null
  }
}

async function generateQuestionsWorthAsking(gaps: string[], roleFacts: string | null): Promise<string[]> {
  if (gaps.length === 0) return []
  try {
    const client = getAnthropicClient()
    const prompt = `Given these uncertainties about a job candidate, generate exactly 3 concrete interview questions a hiring manager could ask to probe them. Return strict JSON: {"questions": ["...", "...", "..."]}. Do NOT produce a scorecard, rubric, or decision framework — just 3 plain questions.

Uncertainties:
${gaps.map((g) => `- ${g}`).join('\n')}

${roleFacts ? `Role context:\n${roleFacts}` : ''}`

    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as { questions?: string[] }
    return parsed.questions?.slice(0, 3) ?? []
  } catch (error) {
    console.error('Failed to generate questions worth asking for evidence brief', error)
    return []
  }
}

export async function generateEvidenceBrief(
  candidateId: string,
  employerId: string,
  roleId?: string
): Promise<EvidenceBrief | null> {
  const [candidate, approvedEmployer, role] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        workHistory: { orderBy: { startDate: 'desc' } },
        workSamples: true,
        references: {
          where: {
            status: 'COMPLETED',
            OR: [{ candidateDisputedAt: null }, { disputeResolvedAt: { not: null } }],
          },
        },
        jobPostings: { select: { appliedAt: true } },
        outreachLogs: { select: { id: true } },
        learningBadges: { select: { id: true } },
      },
    }),
    prisma.approvedEmployer.findUnique({
      where: { candidateId_employerId: { candidateId, employerId } },
    }),
    roleId ? prisma.roleProfile.findUnique({ where: { id: roleId } }) : null,
  ])
  if (!candidate) return null

  // Access-control gate (a real interaction must exist) is enforced by the
  // caller before this generator is invoked — this function only handles the
  // identity-reveal branch, not whether the employer may view this candidate
  // at all.
  const identityRevealed = !!approvedEmployer

  const displayedWorkHistory = selectDisplayedWorkHistory(candidate.workHistory).map((w) => ({
    companyName: w.companyName,
    roleTitle: sanitizeRoleTitle(w.roleTitle),
    startDate: w.startDate,
    endDate: w.endDate,
    isCurrent: w.isCurrent,
    keyAchievement: w.keyAchievement,
  }))

  const effortSummaryLines = computeEffortSummaryLines({
    learningCount: candidate.learningBadges.length,
    applicationsCount: candidate.jobPostings.filter((j) => j.appliedAt !== null).length,
    outreachCount: candidate.outreachLogs.length,
  })

  const gaps: string[] = []
  if (candidate.references.length === 0) gaps.push('No verified references collected yet.')
  if (candidate.workSamples.length === 0) gaps.push('No work samples or case studies provided.')
  if (!candidate.targetCompMin) gaps.push('Compensation expectations not confirmed.')

  // A single reference's character-y prose isn't trustworthy triangulated
  // evidence on its own — see evidence-type.ts. Below the threshold, the fit
  // narrative draws only on objective facts (function, level, work history),
  // not one person's characterization.
  const signalsUnlocked = characterSignalsUnlocked(candidate.references.length)
  const candidateFacts = [
    `Function: ${candidate.primaryFunction ?? 'not specified'}`,
    `Level: ${candidate.highestLevelReached ?? 'not specified'}`,
    `Work history: ${displayedWorkHistory.map((w) => `${w.roleTitle} at ${w.companyName}`).join('; ') || 'none logged'}`,
    signalsUnlocked
      ? `Reference themes: ${candidate.references.map((r) => r.strengthSummary).filter(Boolean).join('; ') || 'none yet'}`
      : `Reference themes: not enough references yet to characterize (need ${CHARACTER_SIGNAL_MIN_REFERENCES - candidate.references.length} more)`,
  ].join('\n')

  const roleFacts = role
    ? [
        `Role: ${role.roleTitle}`,
        `Function: ${role.primaryFunction ?? 'not specified'}`,
        `Level: ${role.roleLevel ?? 'not specified'}`,
      ].join('\n')
    : null

  const [whyTheyMightFit, questionsWorthAsking] = await Promise.all([
    generateFitNarrative({ candidateFacts, roleFacts }),
    generateQuestionsWorthAsking(gaps, roleFacts),
  ])

  return {
    identityRevealed,
    candidateName: identityRevealed
      ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate'
      : `${candidate.highestLevelReached ?? 'Experienced'} ${candidate.primaryFunction ?? 'professional'}`,
    workHistory: displayedWorkHistory,
    workSamples: candidate.workSamples.map((s) => ({
      title: s.title,
      description: s.description,
      outcome: s.outcome,
    })),
    effortSummaryLines,
    whyTheyMightFit,
    whyTheyMightFitEvidenceType: 'ai_inferred',
    gaps,
    questionsWorthAsking,
    availability: {
      statusLabel: candidate.currentJobStatus,
      targetRoleType: candidate.targetRoleType,
      primaryFunction: candidate.primaryFunction,
      highestLevelReached: candidate.highestLevelReached,
    },
    approvalPending: !identityRevealed,
  }
}
