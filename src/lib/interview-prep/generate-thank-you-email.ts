import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'

export interface ThankYouEmailInput {
  interviewerName?: string | null
  interviewerTitle?: string | null
  companyName: string
  roleTitle: string
  discussionPoints: string
  tone: 'warm' | 'professional' | 'enthusiastic'
  jobDescription?: string | null
}

const BANNED_OPENERS = [
  'Thank you for taking the time to interview me',
  'It was great meeting with you today',
]

const PROMPT_PREFIX = `Write a post-interview thank-you email from the candidate to the interviewer. Never open with either of these generic lines (or anything that reads like a template of them): ${BANNED_OPENERS.map((o) => `"${o}"`).join(' / ')}. Instead open by referencing something specific from the actual conversation below. Keep it to 3-4 short paragraphs: a specific opening tied to the conversation, a brief reinforcement of fit grounded in the discussion points, and a short close. Plain prose, ready to send — no subject line, no markdown, no placeholder brackets.

Interview details:
`

export async function generateThankYouEmail(input: ThankYouEmailInput): Promise<string | null> {
  const summary = `
Interviewer: ${input.interviewerName ? `${input.interviewerName}${input.interviewerTitle ? `, ${input.interviewerTitle}` : ''}` : 'the interviewer'}
Company: ${input.companyName}
Role: ${input.roleTitle}
Tone: ${input.tone}
What we discussed: ${input.discussionPoints}
${input.jobDescription ? `Job posting: ${input.jobDescription}` : ''}
`.trim()

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 700,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: `${PROMPT_PREFIX}${summary}` }],
  })
  const message = await stream.finalMessage()
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  return text || null
}
