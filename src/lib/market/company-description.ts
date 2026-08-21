import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'

const descriptionSchema = z.object({
  // false if this isn't a real/identifiable company name at all — never
  // invent a description for something unrecognizable.
  recognized: z.boolean(),
  description: z.string().nullable(),
})

// One real LLM call per distinct company name, ever — the caller
// (resolveCompanyMetadataIfMissing) caches the result directly on
// Company.description, so this never re-runs for a company once resolved.
// Same cost-scoped, candidate-view-triggered pattern as
// resolveCompanyIndustry/resolveCompanySizeBand.
export async function resolveCompanyDescription(companyName: string): Promise<string | null> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(descriptionSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `Write one plain, factual sentence describing what "${companyName}" actually does — the kind of line a job seeker researching this company would want. No marketing language, no superlatives ("leading", "innovative", "world-class").

If "${companyName}" isn't a real, identifiable company (a placeholder, a typo, or too vague to identify), set recognized to false and description to null.`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output
    if (!data || !data.recognized || !data.description) return null
    return data.description
  } catch (error) {
    console.error('Failed to resolve company description for', companyName, error)
    return null
  }
}
