import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Prisma } from '@prisma/client'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { getCompetencyGaps, competenciesNeedingEvidence } from '@/lib/talent/competency-gaps'
import { buildHiringDossierView } from '@/lib/talent/dossier-view'
import { getReferenceQuestions } from '@/lib/talent/reference-questions'

// Ported from src/lib/hiring/generate-interview-guide.ts as part of the
// /hiring -> /talent consolidation — scoped to a submissionId/candidateId,
// nothing hiring-manager-specific, so this moved verbatim (also reusing
// buildHiringDossierView, since relocated to src/lib/talent/dossier-view.ts
// alongside it once /hiring itself was deleted).
//
// §A8 — "generated interview guide from Dossier gaps." Same house pattern
// as src/lib/jobs/generate-interview-prep.ts (the candidate-side interview
// prep — the closest existing precedent, same generation task from the
// other side of the table): claude-sonnet-5, bounded max_tokens, structured
// output via zodOutputFormat rather than free text + manual JSON parsing.
const interviewGuideSchema = z.object({
  questions: z
    .array(
      z.object({
        competency: z.enum(['leadership', 'skillsExecution', 'communication', 'adaptability', 'ownership']).nullable(),
        question: z.string(),
        rationale: z.string(),
      })
    )
    .min(4)
    .max(10),
})

const PROMPT_PREFIX = `A hiring panel is about to interview a candidate who was submitted to an open role. Generate real, specific interview questions targeting what this candidate's Dossier does NOT already have strong evidence for — a competency with thin or no reference corroboration, or a named narrative gap. Do not write generic interview-advice questions ("tell me about yourself," "what's your greatest weakness") — every question must be something this panel can't already answer from the material below, grounded in this candidate's actual background.

For each question, name which of the five competencies it targets (leadership, skillsExecution, communication, adaptability, ownership) — or null if it targets a narrative gap that isn't one of the five. Give a one-sentence rationale explaining why this is worth asking THIS candidate.

`

export async function generateInterviewGuide(submissionId: string): Promise<void> {
  const submission = await prisma.recruiterCandidateSubmission.findUniqueOrThrow({ where: { id: submissionId } })
  const candidateId = submission.candidateId

  const [dossier, gaps, referenceQuestions] = await Promise.all([
    buildHiringDossierView(candidateId),
    getCompetencyGaps(candidateId),
    getReferenceQuestions(candidateId),
  ])

  if (!dossier) {
    await prisma.interviewGuide.upsert({
      where: { submissionId },
      create: { submissionId, generationError: 'No Dossier available for this candidate yet.' },
      update: { generationError: 'No Dossier available for this candidate yet.' },
    })
    return
  }

  const needsEvidence = competenciesNeedingEvidence(gaps)
  const gapSummary =
    needsEvidence.length > 0
      ? needsEvidence
          .map((g) => {
            const evidence = [g.referenceThin ? 'no reference evidence' : null, g.assessmentThin ? 'no assessment evidence' : null]
              .filter(Boolean)
              .join(', ')
            return `- ${g.label}: ${evidence || 'named narrative gap'}${g.narrativeGapText ? ` — ${g.narrativeGapText}` : ''}`
          })
          .join('\n')
      : 'Every competency has at least reference or assessment evidence — focus on deepening the strongest and thinnest of what exists rather than pure gaps.'

  const candidateSummary = `
Target role: ${dossier.candidateTargetTitle ?? 'not specified'}
Positioning: ${dossier.positioningStatement ?? 'not available'}
Strengths on file: ${dossier.categoryStrengths.map((s) => `${s.label} — ${s.text}`).join('; ') || 'none yet'}
How they operate: ${dossier.howIOperateSummaries.join('; ') || 'not available'}
Self-awareness / growth areas: ${dossier.selfAwareness ?? 'not available'}
Proof points on file: ${dossier.proofPoints.map((p) => `Q: ${p.question} / A: ${p.response}`).join('\n') || 'none yet'}

Competency gaps to target:
${gapSummary}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(interviewGuideSchema), effort: 'medium' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${candidateSummary}` }],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) {
      await prisma.interviewGuide.upsert({
        where: { submissionId },
        create: { submissionId, generationError: 'No guide returned from the model.' },
        update: { generationError: 'No guide returned from the model.' },
      })
      return
    }

    await prisma.interviewGuide.upsert({
      where: { submissionId },
      create: {
        submissionId,
        candidateQuestions: data.questions as unknown as Prisma.InputJsonValue,
        referenceQuestions: referenceQuestions as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
        generationError: null,
      },
      update: {
        candidateQuestions: data.questions as unknown as Prisma.InputJsonValue,
        referenceQuestions: referenceQuestions as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
        generationError: null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interview guide generation failed.'
    await prisma.interviewGuide.upsert({
      where: { submissionId },
      create: { submissionId, generationError: message },
      update: { generationError: message },
    })
  }
}
