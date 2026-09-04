import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'

const MIN_RESUME_TEXT_LENGTH = 40

const classificationSchema = z.object({
  isResume: z.boolean(),
  // Only meaningful when isResume is false — a short, plain-language,
  // candidate-facing sentence explaining what the document actually looks
  // like instead, so uploadResume's rejection message can quote it directly
  // rather than showing a generic "invalid file" error.
  reason: z.string().nullable(),
})

const CLASSIFICATION_PROMPT = `Is this document actually a resume/CV — something describing a person's work history, education, and skills for job-seeking purposes?

Answer isResume: true for anything that is genuinely a resume, even if it's short, unusually formatted, a student/entry-level resume with little experience, or missing a few common sections. Be lenient — only answer false when the document is clearly NOT a resume at all: a cover letter, a blank or near-blank page, an unrelated document (invoice, article, random file), or gibberish/corrupted text.

If isResume is false, set reason to one short, plain sentence describing what the document actually looks like instead (e.g. "This looks like a cover letter, not a resume." or "This document doesn't contain any work history or education."), written for the person who uploaded it. If isResume is true, reason must be null.

Document text:
`

// A one-off, single-purpose classification separate from
// extractProfileFieldsFromResume — kept as its own small Haiku call
// (deliberately not folded into that function's already-at-capacity
// extraction schema) so uploadResume can decide whether to run the rest of
// the pipeline at all *before* any profile fields get written from a
// document that was never a resume in the first place. Permissive on any
// internal failure — a classification-call error must never block a real
// resume upload, so it always resolves to {isResume: true, reason: null}
// rather than throwing.
export async function classifyResumeDocument(text: string | null): Promise<{ isResume: boolean; reason: string | null }> {
  if (!text || text.trim().length < MIN_RESUME_TEXT_LENGTH) {
    return {
      isResume: false,
      reason: "We couldn't find any readable text in that file — it may be a scanned image or empty document.",
    }
  }

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(classificationSchema) },
      messages: [{ role: 'user', content: CLASSIFICATION_PROMPT + text }],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output
    if (!data) return { isResume: true, reason: null }
    return { isResume: data.isResume, reason: data.isResume ? null : data.reason }
  } catch (error) {
    console.error('Failed to classify uploaded document as a resume:', error)
    return { isResume: true, reason: null }
  }
}
