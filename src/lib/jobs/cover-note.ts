import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

/**
 * A short cover note for one job board posting, drafted on a member's
 * click. One Claude Haiku call (~$0.003) per new draft, capped at
 * DAILY_LIMIT per member per day; asking again for the same job returns the
 * saved draft at no cost.
 */

export const COVER_NOTE_DAILY_LIMIT = 10

export type CoverNoteResult =
  | { ok: true; body: string; remainingToday: number; reused: boolean }
  | { ok: false; error: string }

export async function draftCoverNote(candidateId: string, postingId: string): Promise<CoverNoteResult> {
  const existing = await prisma.jobCoverNote.findFirst({
    where: { candidateId, postingId },
    orderBy: { createdAt: 'desc' },
  })
  const since = new Date(Date.now() - 86_400_000)
  const usedToday = await prisma.jobCoverNote.count({ where: { candidateId, createdAt: { gte: since } } })
  if (existing) return { ok: true, body: existing.body, remainingToday: Math.max(0, COVER_NOTE_DAILY_LIMIT - usedToday), reused: true }
  if (usedToday >= COVER_NOTE_DAILY_LIMIT) {
    return { ok: false, error: `You've drafted ${COVER_NOTE_DAILY_LIMIT} cover notes in the last 24 hours. You can draft more tomorrow.` }
  }

  const [posting, candidate] = await Promise.all([
    prisma.exclusiveJobPosting.findUnique({ where: { id: postingId } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, include: { workHistory: true } }),
  ])
  if (!posting || !candidate) return { ok: false, error: 'That job or your profile could not be found.' }

  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const recipient =
    posting.sourceCategory === 'search_firm'
      ? `the consultant at ${posting.sourceName ?? 'the search firm'} running this search`
      : `the hiring team at ${confidential ? 'the company' : posting.companyName}`

  const prompt = `Write a short cover note (120–170 words) from this candidate to ${recipient}, for the job below.

Rules:
- Use only facts given here. Never invent employers, numbers, or achievements.
- Open with the specific reason they fit this role, not "I am writing to apply".
- One concrete proof point from their history, if one is given.
- Plain, confident, warm; no clichés ("passionate", "hit the ground running", "synergy").
- End with a simple ask for a conversation. No subject line, no placeholders in brackets, no sign-off name.

Job: ${posting.title}${confidential ? ' (confidential search)' : ` at ${posting.companyName}`}${posting.location ? `, ${posting.location}` : ''}
${posting.description && !confidential ? `Job description (excerpt): ${posting.description.slice(0, 1500)}` : ''}

Candidate:
Name: ${candidate.firstName ?? ''}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${
    candidate.workHistory
      .slice(0, 5)
      .map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`)
      .join('; ') || 'not specified'
  }`

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const body = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!body) return { ok: false, error: 'The draft came back empty. Try again in a moment.' }
    await prisma.jobCoverNote.create({ data: { candidateId, postingId, body } })
    return { ok: true, body, remainingToday: COVER_NOTE_DAILY_LIMIT - usedToday - 1, reused: false }
  } catch {
    return { ok: false, error: "We couldn't draft a note right now. Try again in a moment." }
  }
}
