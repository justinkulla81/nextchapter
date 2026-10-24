import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { captureServerEvent } from '@/lib/posthog/server'
import { DAILY_SUMMARIES_PER_COACH, reserveModelRun } from '@/lib/coach/note-summary-service'
import { loadDraftMaterial, storeDraft, type Result } from '@/lib/coach/session-notes-service'
import { buildDraftInput, buildDraftPrompt, draftSchema, firstNameOf, hasDraftMaterial, type CaptureKind } from '@/lib/coach/session-notes'

// Metered cost, flagged on purpose. One model call per click, never on page load, with the captures and the
// imported notes in (up to about 12,000 characters) and about 900 tokens out. It uses the same client, model and
// daily allowance as the cross-session note summary (reserveModelRun logs every call in CoachNoteSummaryRun).
// The draft is stored as DRAFT and is never sent: only "Send to <name>" sends.

export async function draftSessionSummary(coachId: string, sessionId: string, opts: { replace: boolean }): Promise<Result<{ addedFollowUps: number; addedTopics: number }>> {
  const session = await loadDraftMaterial(coachId, sessionId)
  if (!session) return { ok: false, error: 'We could not find this session. Go back to your clients and open it again.' }
  if (session.summary?.state === 'SENT') return { ok: false, error: 'This summary was already sent, so it can no longer be changed.' }
  const input = {
    coachFirstName: firstNameOf(session.coach.fullName, 'the coach'),
    memberFirstName: session.candidate.firstName?.trim() || 'the client',
    captures: session.captures.map((c) => ({ kind: c.kind as CaptureKind, text: c.text })),
    meetNotes: session.summary?.meetNotes ?? null,
  }
  if (!hasDraftMaterial(input)) return { ok: false, error: 'Add a capture or the call notes first. The draft is written from those.' }
  if (session.summary?.text.trim() && session.summary.state === 'REVIEWED' && !opts.replace) {
    return { ok: false, error: 'You have already edited the summary. Choose “Replace my edits with a new draft” if you want a fresh one.' }
  }

  const run = await reserveModelRun(coachId, session.candidateId, buildDraftInput(input).length)
  if (!run) return { ok: false, error: `You have used today’s ${DAILY_SUMMARIES_PER_COACH} drafts and summaries. You can make more tomorrow, and you can still write the summary yourself.` }

  let parsed: ReturnType<typeof draftSchema.parse> | null = null
  try {
    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 900,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(draftSchema), effort: 'low' },
      messages: [{ role: 'user', content: buildDraftPrompt(input) }],
    })
    parsed = (await stream.finalMessage()).parsed_output ?? null
  } catch (error) {
    console.error('Failed to draft the session summary:', error)
  }
  await prisma.coachNoteSummaryRun.update({ where: { id: run.id }, data: { ok: parsed !== null } })
  if (!parsed) return { ok: false, error: 'We could not write the draft just now. Your captures are safe, and you can write the summary yourself or try again in a minute.' }

  const stored = await storeDraft(session, parsed)
  captureServerEvent(coachId, 'coach_session_draft_generated', { sessionId, candidateId: session.candidateId, captures: input.captures.length, hadMeetNotes: Boolean(input.meetNotes), replaced: Boolean(session.summary?.text.trim()), ...stored })
  return { ok: true, ...stored }
}
