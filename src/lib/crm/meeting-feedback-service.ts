import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildFeedbackPrompt, feedbackSchema, feedbackSourceFor, keepVerbatim, suggestionRef } from '@/lib/crm/meeting-feedback'

// Metered cost, flagged on purpose: ONE model call (up to ~3,000 tokens in, ~500 out) per meeting, made only
// when the calendar sweep first copies that meeting's notes onto a CRM person. Re-reading the same notes
// never calls the model again. Never throws: the sweep must not fail because a suggestion could not be made.

/** Files feedback points from a meeting's notes as suggestions for the owner to approve. Returns how many were added. */
export async function suggestFeedbackFromNotes(input: {
  notes: string
  eventId: string
  eventTitle: string
  meetingAt: Date
  notesUrl: string
  personId: string
  personName: string
}): Promise<number> {
  try {
    const person = await prisma.crmPerson.findUnique({
      where: { id: input.personId },
      select: { roles: true, candidateId: true },
    })
    if (!person) return 0

    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 900,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(feedbackSchema), effort: 'low' },
      messages: [{ role: 'user', content: buildFeedbackPrompt(input.notes, input.personName) }],
    })
    const message = await stream.finalMessage()
    const items = keepVerbatim(message.parsed_output?.items ?? [], input.notes)
    if (items.length === 0) return 0

    const source = feedbackSourceFor(person.roles)
    const created = await prisma.productFeedbackSuggestion.createMany({
      skipDuplicates: true,
      data: items.map((it, n) => ({
        sourceRef: suggestionRef(input.eventId, input.personId, n),
        personId: input.personId,
        candidateId: person.candidateId,
        personLabel: input.personName,
        source,
        theme: it.theme,
        rawText: it.quote,
        meetingTitle: input.eventTitle,
        meetingAt: input.meetingAt,
        notesUrl: input.notesUrl,
      })),
    })
    if (created.count > 0) {
      captureServerEvent('system', 'product_feedback_suggested', {
        personId: input.personId, candidateId: person.candidateId, eventId: input.eventId, source, count: created.count,
      })
    }
    return created.count
  } catch (error) {
    console.error('Failed to suggest feedback from meeting notes:', error)
    return 0
  }
}
