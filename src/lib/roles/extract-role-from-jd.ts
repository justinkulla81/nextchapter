import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'

export interface ExtractedRoleFields {
  roleTitle: string | null
  primaryFunction: string | null
  roleLevel: string | null
  locationRequirement: string | null
  remotePolicy: string | null
  compMin: number | null
  compMax: number | null
}

const PROMPT_PREFIX = `Extract structured role details from this pasted job description. Return strict JSON with this exact shape, no markdown, no extra keys:
{"roleTitle": "...", "primaryFunction": "...", "roleLevel": "...", "locationRequirement": "...", "remotePolicy": "...", "compMin": 0, "compMax": 0}

Rules:
- roleTitle: the job title as stated.
- primaryFunction: pick the single closest match from this exact list, or null if none fit: ${PRIMARY_FUNCTION_OPTIONS.join(', ')}.
- roleLevel: pick the single closest match from this exact list, or null if none fit: ${HIGHEST_LEVEL_OPTIONS.join(', ')}.
- locationRequirement: the city/region stated, or null if not mentioned.
- remotePolicy: one of "onsite", "remote", "hybrid", or null if not stated.
- compMin / compMax: the stated salary range as plain numbers (e.g. 120000), or null if no range is given. Never guess a number that isn't in the text.
- If a field's value isn't clearly stated in the text, return null for it — do not guess or infer.

Job description:
`

export async function extractRoleFromJD(text: string): Promise<ExtractedRoleFields> {
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
  const empty: ExtractedRoleFields = {
    roleTitle: null,
    primaryFunction: null,
    roleLevel: null,
    locationRequirement: null,
    remotePolicy: null,
    compMin: null,
    compMax: null,
  }
  if (!match) return empty

  try {
    return { ...empty, ...(JSON.parse(match[0]) as Partial<ExtractedRoleFields>) }
  } catch {
    return empty
  }
}
