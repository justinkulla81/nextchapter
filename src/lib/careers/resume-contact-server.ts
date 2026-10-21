import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { findEmailInResumeText } from '@/lib/careers/resume-contact'
import { guessNameFromResumeText } from '@/lib/careers/resume-name'

const nameSchema = z.object({ name: z.string().nullable() })

const NAME_PROMPT = `This is the top of a resume. Give the person's full name exactly as written, or null if no person's name appears. Do not guess from an email address.

Resume text:
`

/**
 * The applicant's name and email address, read from the resume text. The email is found by pattern. The name is read
 * from the top lines for free; only when that finds none, one small model call over the first part of the resume
 * reads it (a resume with an unusual layout should not be turned away). A failed call is the same as no name.
 */
export async function readResumeContact(text: string): Promise<{ name: string | null; email: string | null }> {
  const email = findEmailInResumeText(text)
  let name = guessNameFromResumeText(text)
  if (!name) {
    try {
      const stream = getAnthropicClient().messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        thinking: { type: 'disabled' },
        output_config: { format: zodOutputFormat(nameSchema) },
        messages: [{ role: 'user', content: NAME_PROMPT + text.slice(0, 1500) }],
      })
      const message = await stream.finalMessage()
      const read = message.parsed_output?.name?.trim() ?? ''
      name = read && read.length <= 80 && !/[@\d]/.test(read) ? read : null
    } catch (error) {
      console.error('Career application name read failed:', error)
    }
  }
  return { name, email }
}
