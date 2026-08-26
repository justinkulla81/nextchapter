import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { CRUCIBLE_DATASET_TASK, CRUCIBLE_FLUENCY_TASK, CRUCIBLE_PROMPT_TASK, CRUCIBLE_RESULTS_TASK } from './variants'
import type { CrucibleAiGradeResult, CrucibleTierKey } from './scoring-types'

// Real per-attempt LLM cost — every call here is rate-limited upstream (see
// checkAndRecordCrucibleAiUsage in rate-limit.ts) before this module is
// ever reached. Unlike scoring.ts, this is NOT deterministic — a rerun of
// the exact same submission can score slightly differently. That's an
// accepted, explicit boundary (see SCORING_VERSION comment in scoring.ts).
const gradeSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
})

// A transient grading failure shouldn't tank a real candidate's score — 50
// (neutral, not a penalty) with an honest note, rather than 0.
const FALLBACK_GRADE: CrucibleAiGradeResult = {
  score: 50,
  feedback: "We couldn't score this part automatically — it didn't count against you.",
}

async function gradeSubmission(label: string, taskDescription: string, rubric: string, submission: string): Promise<CrucibleAiGradeResult> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(gradeSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: `You are grading a job candidate's submission for a hiring-assessment exercise called "${label}". Be a fair but discerning grader — this is meant to differentiate real skill, not hand out high scores by default.

Task given to the candidate:
${taskDescription}

Grading rubric (internal — never shown to the candidate):
${rubric}

Candidate's submission:
"""
${submission}"""

Score 0-100 based on how well the submission matches the rubric. Then write brief, specific, candidate-facing feedback (2-3 sentences) explaining the score — what was strong, what was missing.`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output
    if (!data) return FALLBACK_GRADE
    return { score: Math.round(Math.max(0, Math.min(100, data.score))), feedback: data.feedback }
  } catch (error) {
    console.error(`Crucible "${label}" grading failed:`, error)
    return FALLBACK_GRADE
  }
}

export function gradeCruciblePromptTask(tier: CrucibleTierKey, submission: string): Promise<CrucibleAiGradeResult> {
  const content = CRUCIBLE_PROMPT_TASK[tier]
  return gradeSubmission('prompt-authoring', content.instructions, content.gradingRubric, submission)
}

export function gradeCrucibleDatasetTask(tier: CrucibleTierKey, submission: string): Promise<CrucibleAiGradeResult> {
  const content = CRUCIBLE_DATASET_TASK[tier]
  return gradeSubmission('dataset-analysis', `${content.businessContext}\n\n${content.instructions}`, content.gradingRubric, submission)
}

// The only generation (not grading) call in this file — sends the fixed
// scenario conversation (original question + the deliberately generic
// canned response) plus the candidate's own follow-up as a real multi-turn
// conversation, and returns whatever the model actually says next. This is
// what makes the fluency activity an honest test: the candidate's follow-up
// is judged by its REAL effect on a live model, not by how it reads on its
// own. A transient failure returns null — the caller must not silently
// grade an empty response as if the AI produced nothing meaningful.
export async function generateCrucibleFluencyResponse(followUpPrompt: string): Promise<string | null> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      thinking: { type: 'disabled' },
      messages: [
        { role: 'user', content: CRUCIBLE_FLUENCY_TASK.originalQuestion },
        { role: 'assistant', content: CRUCIBLE_FLUENCY_TASK.genericResponse },
        { role: 'user', content: followUpPrompt },
      ],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
    return text || null
  } catch (error) {
    console.error('Crucible fluency generation failed:', error)
    return null
  }
}

export function gradeCrucibleFluencyTask(generatedResponse: string): Promise<CrucibleAiGradeResult> {
  return gradeSubmission(
    'ai-fluency',
    `${CRUCIBLE_FLUENCY_TASK.businessContext}\n\nOriginal question: ${CRUCIBLE_FLUENCY_TASK.originalQuestion}\n\nGeneric first response: ${CRUCIBLE_FLUENCY_TASK.genericResponse}`,
    CRUCIBLE_FLUENCY_TASK.gradingRubric,
    generatedResponse
  )
}

export function gradeCrucibleResultsTask(submission: string): Promise<CrucibleAiGradeResult> {
  return gradeSubmission(
    'read-the-results',
    `${CRUCIBLE_RESULTS_TASK.businessContext}\n\n${CRUCIBLE_RESULTS_TASK.instructions}`,
    CRUCIBLE_RESULTS_TASK.gradingRubric,
    submission
  )
}
