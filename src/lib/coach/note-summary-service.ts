import 'server-only'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  buildNotesInput,
  buildSummaryPrompt,
  notesFingerprint,
  parseStoredSummary,
  summarySchema,
  type NoteSession,
  type NoteSummary,
} from '@/lib/coach/note-summary'

// Metered cost, flagged on purpose. Each generation is ONE model call with up to
// MAX_TOTAL_CHARS (12,000 characters, roughly 3,000 tokens) of the coach's own notes in and up
// to ~900 tokens out. It only runs when a coach clicks the button, never on page load, a
// saved summary is reused until the notes change, and each coach is capped per day. Compare the
// pre-session brief, which calls a model on every view. Every call is logged in
// CoachNoteSummaryRun so spend can be reported.
export const DAILY_SUMMARIES_PER_COACH = 30

export type SummaryView = {
  summary: NoteSummary
  generatedAt: Date
  sessionCount: number
  truncated: boolean
  /** True when notes have changed since this summary was written. */
  stale: boolean
} | null

async function loadSessions(coachId: string, candidateId: string): Promise<NoteSession[]> {
  // Only this coach's own sessions: session notes are private to the coach who wrote them.
  return prisma.coachSession.findMany({
    where: { coachId, candidateId },
    orderBy: { occurredAt: 'asc' },
    select: { id: true, occurredAt: true, notes: true, directives: true, focusNote: true },
  })
}

export async function getNoteSummaryView(coachId: string, candidateId: string): Promise<{ view: SummaryView; sessionsWithNotes: number }> {
  const sessions = await loadSessions(coachId, candidateId)
  const { usedSessions } = buildNotesInput(sessions)
  const sessionsWithNotes = sessions.filter((s) => s.notes?.trim() || s.directives?.trim() || s.focusNote?.trim()).length
  try {
    const row = await prisma.coachNoteSummary.findUnique({ where: { coachId_candidateId: { coachId, candidateId } } })
    const summary = row ? parseStoredSummary(row.summary) : null
    if (!row || !summary) return { view: null, sessionsWithNotes }
    return {
      view: { summary, generatedAt: row.generatedAt, sessionCount: row.sessionCount, truncated: row.truncated, stale: row.fingerprint !== notesFingerprint(sessions) },
      sessionsWithNotes: usedSessions > 0 ? sessionsWithNotes : 0,
    }
  } catch (error) {
    // The table may not exist yet; the rest of the page must still load.
    console.error('Failed to load coach note summary:', error)
    return { view: null, sessionsWithNotes }
  }
}

type Generated = { ok: true; summary: NoteSummary } | { ok: false; error: string }

export async function generateNoteSummary(coachId: string, candidateId: string): Promise<Generated> {
  const sessions = await loadSessions(coachId, candidateId)
  const input = buildNotesInput(sessions)
  if (input.usedSessions === 0) return { ok: false, error: 'There are no session notes to summarize yet. Log a session with notes first.' }

  const fingerprint = notesFingerprint(sessions)
  const existing = await prisma.coachNoteSummary.findUnique({ where: { coachId_candidateId: { coachId, candidateId } } })
  const existingSummary = existing ? parseStoredSummary(existing.summary) : null
  if (existing && existingSummary && existing.fingerprint === fingerprint) return { ok: true, summary: existingSummary }

  // Reserve the run BEFORE calling the model, under a per-coach lock, so two clicks at once cannot both
  // slip under the daily cap. A reserved run counts against the cap even if the call then fails.
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const run = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`note-summary:${coachId}`}))`)
    const usedToday = await tx.coachNoteSummaryRun.count({ where: { coachId, createdAt: { gte: startOfDay } } })
    if (usedToday >= DAILY_SUMMARIES_PER_COACH) return null
    return tx.coachNoteSummaryRun.create({ data: { coachId, candidateId, inputChars: input.text.length, ok: false }, select: { id: true } })
  })
  if (!run) {
    return { ok: false, error: `You have used today’s ${DAILY_SUMMARIES_PER_COACH} summaries. You can make more tomorrow, and your notes are still all here to read.` }
  }

  let summary: NoteSummary | null = null
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 900,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(summarySchema), effort: 'low' },
      messages: [{ role: 'user', content: buildSummaryPrompt(input.text) }],
    })
    const message = await stream.finalMessage()
    summary = message.parsed_output ?? null
  } catch (error) {
    console.error('Failed to generate coach note summary:', error)
  }

  await prisma.coachNoteSummaryRun.update({ where: { id: run.id }, data: { ok: summary !== null } })
  if (!summary) return { ok: false, error: 'We could not write the summary just now. Your notes are safe. Try again in a minute.' }

  await prisma.coachNoteSummary.upsert({
    where: { coachId_candidateId: { coachId, candidateId } },
    create: { coachId, candidateId, summary, sessionCount: input.usedSessions, fingerprint, truncated: input.truncated },
    update: { summary, sessionCount: input.usedSessions, fingerprint, truncated: input.truncated, generatedAt: new Date() },
  })
  return { ok: true, summary }
}
