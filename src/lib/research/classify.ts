import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'

// A short, editable list of positions this product has already locked in —
// used only to flag research that appears to contradict one, per Prompt 64's
// "don't let this sit quietly in a routine digest" requirement. Extend as
// new decisions get locked; nothing here is enforced in code, it's context
// for the classifier's judgment call.
const LOCKED_PRODUCT_DECISIONS = [
  'Candidates are always shown a letter grade (A-F), never a raw numeric score.',
  'Coaches never see a candidate\'s Hireability grade before a match is confirmed.',
  'Employers and recruiters never see a candidate\'s internal Hireability grade under any circumstance.',
  'The AI coaching persona (Victoria) escalates directness based on weeks unemployed, not a single fixed tone.',
  'Coach-candidate matching at current scale runs on manual admin oversight, not automated fairness enforcement.',
]

const CONFIDENCE_THRESHOLD = 0.6

const classificationSchema = z.object({
  summary: z.string(),
  bucket: z.enum(['GUIDE_SEO', 'MARKET_BRIEF', 'PRODUCT_POSITIONING', 'PR_MEDIA_HOOK', 'PERSONA_RESEARCH']),
  confidenceScore: z.number().min(0).max(1),
  credibilityTier: z.enum(['recognized', 'unknown']),
  suggestedAction: z.string(),
  contradictsLockedDecision: z.boolean(),
  personaTag: z
    .enum([
      'COMPANY_WIDE_LAYOFF', 'DIVISION_ELIMINATED', 'COMPANY_SHUTDOWN', 'ACQUISITION_REDUNDANCY',
      'OFFSHORED_OUTSOURCED', 'LEFT_TO_START_SOMETHING', 'CAREGIVER_LEAVE', 'SABBATICAL',
      'VALUES_MISALIGNMENT', 'CAREER_PIVOT', 'BURNOUT', 'NEW_MANAGEMENT', 'LEFT_DIFFICULT_ENVIRONMENT',
      'PERFORMANCE_SEPARATION', 'COMPLICATED', 'FIRST_ROLE', 'RETURNING_AFTER_ABSENCE',
      'RELOCATED_FOR_FAMILY', 'MEDICAL_LEAVE', 'CURRENTLY_EMPLOYED_EXPLORING',
    ])
    .nullable(),
})

export type ResearchClassification = z.infer<typeof classificationSchema>

const PROMPT = `You are triaging an article for NextChapter, a job-transition platform for laid-off/pivoting/returning professionals, so the team can decide what to do with it.

Summarize the article in 1-2 sentences. This is the single most important rule: PARAPHRASE ONLY. Never reproduce more than about 15 consecutive words verbatim from the source, and never include more than one direct quote from it. Rephrase everything else in your own words. Do not quote song lyrics or scripts under any circumstance.

Classify into exactly one bucket:
- GUIDE_SEO: could support or improve one of our /resources/* guide pages, or is a candidate for a brand-new guide page.
- MARKET_BRIEF: a stat, trend, or data point worth citing in a weekly market-conditions email to candidates/coaches/recruiters/employers.
- PRODUCT_POSITIONING: evidence relevant to how we position the product or the "Victoria"/Executive Dossier copy.
- PR_MEDIA_HOOK: a real press/media opportunity or hook — something time-sensitive worth acting on immediately, not routine.
- PERSONA_RESEARCH: relevant to a specific situational persona (layoff type, career pivot, return from leave, etc.) — set personaTag to the closest matching value, or null if none fits well.

Give a confidenceScore from 0 to 1 for how confident you are in this classification — be honest, not falsely confident.

Rate credibilityTier: "recognized" for an established outlet, academic source, or named-author professional publication; "unknown" for an unattributed blog, low-quality aggregator, or unclear source.

Write a one-sentence suggestedAction appropriate to the bucket (e.g. "Cite in next Market Brief" / "Draft an addition to the [X] guide" / "Flag to Victoria copy owner" / "Pitch angle: ...").

Finally, check contradictsLockedDecision: does this article's finding meaningfully contradict or complicate any of these already-locked product decisions? Only mark true if there's a real, specific tension — not a loose thematic connection.
${LOCKED_PRODUCT_DECISIONS.map((d, i) => `${i + 1}. ${d}`).join('\n')}

`

export async function classifyResearchItem(
  url: string,
  title: string | null,
  articleText: string
): Promise<ResearchClassification & { needsReview: boolean }> {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(classificationSchema), effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: `${PROMPT}URL: ${url}\nTitle: ${title ?? 'unknown'}\n\nArticle text:\n${articleText}`,
      },
    ],
  })
  const message = await stream.finalMessage()
  const data = message.parsed_output

  if (!data) {
    throw new Error('Classification returned no output.')
  }

  return { ...data, needsReview: data.confidenceScore < CONFIDENCE_THRESHOLD }
}
