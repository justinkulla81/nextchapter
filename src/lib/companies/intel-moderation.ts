import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'

// Moderation for CompanyIntel ("how to get hired here") — Phase 2 Master
// Script, Part C, Prompt 5 (which reaches into this phase since intel needs
// moderation before publish, per verification item 7: "Moderation runs
// before publish, not after").
//
// The spec cites "NextChapter_Search_Visibility_and_Leaderboards.md §8" for
// this taxonomy — that file doesn't exist under that name, and the real
// file (NextChapter_Search_Visibility_References_Leaderboards.md) has no
// §8 about moderation at all (its real §8 is reference-sourcing rules,
// unrelated). The actual moderation build in this codebase is
// src/lib/community/moderation.ts (classifyCommunityPost), citing Master
// Build Script §14 — reused here for its call PATTERN (Anthropic +
// zodOutputFormat + confidence + reasoning), not its category taxonomy.
//
// company_intel is a different kind of content than a Community post: it's
// explicitly ABOUT a named employer's hiring process, so "criticizing an
// employer" is the normal, wanted shape of a post there in a way it isn't
// here — the whole point of company_intel is "process and preparation,
// never grievance" (spec Prompt 5). Forcing it through
// CommunityModerationCategory would mean either bolting on two categories
// that don't fit that enum's Community-specific meaning, or leaving the
// non-disparagement/named-individual rules unenforced. This is a small,
// separate taxonomy instead — same underlying Anthropic-call shape, its own
// prompt and category set.

const intelModerationSchema = z.object({
  category: z.enum(['NAMED_INDIVIDUAL', 'DISPARAGEMENT_NOT_PROCESS', 'PII', 'SPAM', 'OK']),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(), // one sentence, admin-facing only
})

export type IntelModerationCategory = z.infer<typeof intelModerationSchema>['category']
export type IntelModerationClassification = z.infer<typeof intelModerationSchema>

const PROMPT = `You are moderating a "how to get hired here" submission on NextChapter's company pages —
crowdsourced guidance from candidates and members who've interviewed at or worked for a specific
employer, meant to help other job seekers understand the interview loop, timeline, and what the
company actually tests for.

This is deliberately NOT a review site. Every submission should read as process and preparation
guidance, never as a grievance against the employer. Classify the text into exactly one category:

- NAMED_INDIVIDUAL: names a specific person (a hiring manager, recruiter, interviewer, executive) by
  name or by a specific enough description that they're identifiable (e.g. "the VP who interviewed me,
  Sarah"). Guidance about a ROLE ("the hiring manager will ask about...") is fine; a specific person is not.
- DISPARAGEMENT_NOT_PROCESS: reads as an allegation of misconduct, a complaint, or a grievance about
  the employer rather than neutral guidance about their hiring process. "They ghosted candidates for
  months" is disparagement; "responses typically take 3-4 weeks" is process guidance about the same
  underlying fact. A severance agreement's non-disparagement clause is the real-world risk this
  protects against — bias toward flagging anything that reads like a complaint rather than a factual,
  neutral description of what to expect.
- PII: shares a specific individual's compensation, or any personal contact information (email, phone,
  home address) for a named or identifiable person. Compensation RANGES or BANDS ("they typically pay
  $180-220k for this level") are fine — only a specific individual's actual pay, or contact info, is PII.
- SPAM: not real hiring-process guidance at all — off-topic, promotional, or nonsensical.
- OK: none of the above — genuine, neutral guidance about interview process, timeline, what's tested,
  who decides, or what tends to trip candidates up.

Give a confidenceScore from 0 to 1 — be honest, not falsely confident. Write one sentence of reasoning
a human moderator will read. Never quote more than a few words of the text back — summarize instead.`

const CONFIDENCE_THRESHOLD = 0.6

export async function classifyCompanyIntel(text: string): Promise<IntelModerationClassification & { needsReview: boolean }> {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(intelModerationSchema), effort: 'medium' },
    messages: [{ role: 'user', content: `${PROMPT}\n\nSubmission:\n${text}` }],
  })
  const message = await stream.finalMessage()
  const data = message.parsed_output

  if (!data) {
    throw new Error('Company intel moderation returned no output.')
  }

  return { ...data, needsReview: data.confidenceScore < CONFIDENCE_THRESHOLD }
}

export type IntelModerationOutcome = 'PUBLISH' | 'HOLD' | 'REMOVE'

// OK publishes immediately. NAMED_INDIVIDUAL/DISPARAGEMENT_NOT_PROCESS hold
// for human review rather than auto-removing — both are judgment calls
// (is this description specific enough to identify someone? is this
// grievance or just a blunt fact?) that deserve a human look before content
// is destroyed, same reasoning src/lib/community/moderation.ts applies to
// its own HOLD categories. PII and SPAM auto-remove — neither has a
// legitimate published form.
const CATEGORY_OUTCOME: Record<IntelModerationCategory, IntelModerationOutcome> = {
  OK: 'PUBLISH',
  NAMED_INDIVIDUAL: 'HOLD',
  DISPARAGEMENT_NOT_PROCESS: 'HOLD',
  PII: 'REMOVE',
  SPAM: 'REMOVE',
}

export function intelModerationOutcome(category: IntelModerationCategory): IntelModerationOutcome {
  return CATEGORY_OUTCOME[category]
}
