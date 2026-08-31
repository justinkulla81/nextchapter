import 'server-only'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { getMechanicalBatchFindings } from '@/lib/walkthrough/mechanical-findings'
import { captureServerEvent } from '@/lib/posthog/server'

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      key: z.string(),
      rewrite: z.string(),
    })
  ),
})

// Never invent a specific number/fact — a "quantify this" fix gets an
// explicit bracketed placeholder for the candidate's own real figure, not a
// fabricated one. A resume claiming an achievement the candidate never had
// is worse than the original vague bullet.
const REWRITE_PROMPT = `You are an executive resume editor. Below are specific issues found on a candidate's resume, each with an instruction for how to fix it. For each issue, write ONE improved version of the flagged sentence/bullet that applies the fix.

Critical rules:
- Never invent a specific number, statistic, company name, or fact that isn't already stated or clearly implied by the issue text. If the fix calls for adding a metric (e.g. "add the number: what changed, from what, to what"), write the sentence with an explicit placeholder in brackets exactly where the real number belongs (e.g. "grew ARR from $[X]M to $[Y]M", "closed [Z] deals") — never make one up.
- Keep the candidate's original facts, scope, and voice; change only what the fix instruction asks for.
- One sentence per issue, in resume-bullet style (no "I" or "my").
- Return exactly one rewrite per issue, matched by its KEY.

Issues to fix:
`

// One suggested rewrite per mechanical finding, generated in a single batched
// call — not one call per finding or per walkthrough step — so this is a
// fixed one-call cost per resume regardless of how many issues it has or how
// many steps the candidate actually visits. Callers should go through
// getOrGenerateRewriteSuggestions below rather than calling this directly,
// so a resume's suggestions are only ever generated once.
async function generateRewriteSuggestions(candidateId: string): Promise<Record<string, string>> {
  const findings = await getMechanicalBatchFindings(candidateId)
  if (findings.length === 0) return {}

  const findingsText = findings
    .map((f) => `KEY: ${f.key}\nISSUE: ${f.finding.candidateFacingCopy}\nFIX INSTRUCTION: ${f.finding.fix}`)
    .join('\n\n')

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    thinking: { type: 'disabled' },
    output_config: { format: zodOutputFormat(SuggestionSchema), effort: 'medium' },
    messages: [{ role: 'user', content: `${REWRITE_PROMPT}${findingsText}` }],
  })
  const message = await stream.finalMessage()
  const parsed = message.parsed_output
  if (!parsed) return {}

  const validKeys = new Set(findings.map((f) => f.key))
  const result: Record<string, string> = {}
  for (const s of parsed.suggestions) {
    if (validKeys.has(s.key)) result[s.key] = s.rewrite
  }
  return result
}

// Cached on the ResumeAnalysis row itself (not the walkthrough session) —
// that's the boundary a finding key is actually scoped to (mechanical-
// findings.ts: indices are only stable within one analysis), so a new
// resume upload correctly gets a blank cache instead of stale suggestions
// for different findings, and restarting the walkthrough doesn't wipe a
// cache it never owned in the first place.
export async function getOrGenerateRewriteSuggestions(candidateId: string): Promise<Record<string, string>> {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, rewriteSuggestions: true },
  })
  if (!analysis) return {}
  if (analysis.rewriteSuggestions) return analysis.rewriteSuggestions as Record<string, string>

  const suggestions = await generateRewriteSuggestions(candidateId)
  if (Object.keys(suggestions).length === 0) return suggestions

  captureServerEvent(candidateId, 'resume_rewrite_suggestions_generated', { count: Object.keys(suggestions).length })

  await prisma.resumeAnalysis
    .update({
      where: { id: analysis.id },
      data: { rewriteSuggestions: suggestions as Prisma.InputJsonValue },
    })
    .catch((error) => console.error('Failed to cache resume rewrite suggestions:', error))

  return suggestions
}
