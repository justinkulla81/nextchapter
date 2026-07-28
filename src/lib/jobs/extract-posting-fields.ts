import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'

export interface ExtractedPostingFields {
  title: string | null
  companyName: string | null
  location: string | null
  salaryMin: number | null
  salaryMax: number | null
  description: string | null
}

const EMPTY: ExtractedPostingFields = {
  title: null,
  companyName: null,
  location: null,
  salaryMin: null,
  salaryMax: null,
  description: null,
}

const PROMPT_PREFIX = `Extract structured job posting details from this page text (a job listing). Return strict JSON with this exact shape, no markdown, no extra keys:
{"title": "...", "companyName": "...", "location": "...", "salaryMin": 0, "salaryMax": 0, "description": "..."}

Rules:
- title: the job title as stated.
- companyName: the hiring company's name.
- location: the city/region or remote status as stated, or null if not mentioned.
- salaryMin / salaryMax: the stated salary range as plain numbers (e.g. 120000), or null if no range is given. Never guess a number that isn't in the text.
- description: a concise 2-3 sentence plain-prose summary of the role, not a copy-pasted dump of the posting.
- If a field isn't clearly stated in the text, return null for it — do not guess or infer.

Page text:
`

// Reuses the same "extract structured fields from raw page text" pattern as
// extract-role-from-jd.ts (built for Talent's Post-a-Role JD paste), but a
// different field shape — ExclusiveJobPosting needs companyName/salary/a
// candidate-facing description, none of which that extractor produces.
export async function extractPostingFields(text: string): Promise<ExtractedPostingFields> {
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: `${PROMPT_PREFIX}${text.slice(0, 8000)}` }],
  })
  const message = await stream.finalMessage()
  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const match = responseText.match(/\{[\s\S]*\}/)
  if (!match) return EMPTY

  try {
    return { ...EMPTY, ...(JSON.parse(match[0]) as Partial<ExtractedPostingFields>) }
  } catch {
    return EMPTY
  }
}
