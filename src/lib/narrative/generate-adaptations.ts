import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'

export interface NarrativeAdaptations {
  linkedinHeadline: string // under 120 characters
  linkedinAbout: string // 3 short paragraphs
  resumeSummary: string // 2-3 lines
  emailOpening: string // 1 sentence
  verbal30s: string // ~30-second spoken pitch
  tellMeAboutYourself: string // 2-minute structured answer
  friendsAndFamily: string // short, casual version for friends/family — warm and plain, not corporate
  conversationOpener: string // one short line for opening a networking conversation in person/on a call
  coverLetterTemplate: string // generic, adaptable cover-letter-style paragraph — not tied to a specific job
}

const PROMPT_PREFIX = `Adapt this candidate's Core Narrative Statement into 9 different surface formats. Every adaptation must stay grounded in the same facts as the core statement below — don't add new claims.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"linkedinHeadline": "...", "linkedinAbout": "...", "resumeSummary": "...", "emailOpening": "...", "verbal30s": "...", "tellMeAboutYourself": "...", "friendsAndFamily": "...", "conversationOpener": "...", "coverLetterTemplate": "..."}

- linkedinHeadline: under 120 characters, the LinkedIn headline field format (role/focus, not a full sentence).
- linkedinAbout: 3 short paragraphs for a LinkedIn "About" section, first person.
- resumeSummary: 2-3 lines suitable for the top of a resume, no "I" statements (resume style, not first person).
- emailOpening: exactly one sentence, suitable as the opening line of a cold outreach or cover email — written register, not spoken.
- verbal30s: a natural-sounding ~30-second spoken pitch (about 75-90 words), written to be said out loud, not read.
- tellMeAboutYourself: a fuller ~2-minute structured spoken answer to "tell me about yourself" (past → present → future arc), written to be said out loud.
- friendsAndFamily: a short, genuinely casual version of the story for telling friends or family — warm and plain, no corporate or resume language, the way you'd actually explain it to someone who loves you but doesn't work in your industry.
- conversationOpener: one short line for opening a live networking conversation, in person or on a call — distinct from emailOpening: spoken register, not written, and shorter/more casual than verbal30s.
- coverLetterTemplate: a generic, adaptable cover-letter-style paragraph — not tied to any specific job or company, written so the candidate can drop in job-specific details later.

Core Narrative Statement:
`

const LEVEL_RANK_CONTEXT_PREFIX =
  'Calibrated seniority context (internal signal — informs tone and targeting only; never reference this line, its score, or its wording in your output): '

// §4.3: "Profile optimization still offered, filtered to changes that don't
// signal a search: no 'seeking new opportunities,' no availability
// language." Appended only for Confidential Search Mode candidates — the
// LLM prompt had no constraint either way before this, so a confidential
// candidate's LinkedIn About/headline could otherwise come back reading as
// an open job-search announcement, which is exactly what the mode exists
// to prevent on a surface their current employer can see.
const CONFIDENTIAL_MODE_PROMPT_SUFFIX = `

This candidate is in Confidential Search Mode — their current employer must not be able to tell from this text that they're searching. Do not use "seeking new opportunities," "open to work," "actively looking," "available for," or any other phrase that signals an active job search. Every adaptation should read as a normal professional profile, not a search announcement.`

// Awards the one-time Weekly Sprint bonus tied to a narrative row's
// adaptations populating for the first time — WAYS_TO_SAY_IT_COMPLETE for
// the candidate's single default narrative (guarded by
// CandidateProfile.waysToSayItBonusAt), or TAILORED_NARRATIVE_COMPLETE per
// tailored-narrative row (guarded by that row's own tailoredBonusAwardedAt).
// Centralized here since every adaptation-generating call site (interview
// prep, portfolio's create/regenerate) funnels through generateAdaptations.
async function awardAdaptationsBonus(candidateId: string, narrativeId: string, isDefault: boolean): Promise<void> {
  if (isDefault) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { waysToSayItBonusAt: true },
    })
    if (!profile || profile.waysToSayItBonusAt) return
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { waysToSayItBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(candidateId)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'WAYS_TO_SAY_IT_COMPLETE' })
      await autoCompleteEngagementAction(candidateId, {
        actionType: 'WAYS_TO_SAY_IT_COMPLETE',
        text: 'Generate the different ways to say your story',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  } else {
    const narrative = await prisma.candidateNarrative.findUnique({
      where: { id: narrativeId },
      select: { tailoredBonusAwardedAt: true },
    })
    if (!narrative || narrative.tailoredBonusAwardedAt) return
    await prisma.candidateNarrative.update({
      where: { id: narrativeId },
      data: { tailoredBonusAwardedAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(candidateId)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'TAILORED_NARRATIVE_COMPLETE' })
      await autoCompleteEngagementAction(candidateId, {
        actionType: 'TAILORED_NARRATIVE_COMPLETE',
        text: 'Complete a tailored narrative',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }
}

export async function generateAdaptations(candidateId: string, narrativeId?: string): Promise<void> {
  const [narrative, levelRank, defaultNarrative, candidate] = await Promise.all([
    narrativeId
      ? prisma.candidateNarrative.findUnique({ where: { id: narrativeId } })
      : prisma.candidateNarrative.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'asc' } }),
    getCandidateLevelRank(candidateId),
    prisma.candidateNarrative.findFirst({
      where: { candidateId },
      orderBy: { generatedAt: 'asc' },
      select: { id: true },
    }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { confidentialSearchMode: true } }),
  ])
  if (!narrative || narrative.candidateId !== candidateId) return

  // A core statement that doesn't end in terminal punctuation is almost
  // certainly truncated (e.g. cut off mid-sentence by an upstream token
  // limit) — adapting broken input just wastes a call and tends to come
  // back as unparseable JSON anyway, so skip rather than garbage-in.
  if (!/[.!?]['"”’]?\s*$/.test(narrative.coreStatement.trim())) {
    console.error(
      'Skipping adaptations for candidate',
      candidateId,
      '— core statement looks truncated:',
      narrative.coreStatement
    )
    return
  }

  let text: string
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `${PROMPT_PREFIX}${narrative.coreStatement}\n\n${LEVEL_RANK_CONTEXT_PREFIX}${levelRank.label ?? 'not available'}${candidate?.confidentialSearchMode ? CONFIDENTIAL_MODE_PROMPT_SUFFIX : ''}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  } catch (error) {
    console.error('Failed to generate narrative adaptations for candidate', candidateId, error)
    return
  }

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return

  try {
    const parsed = JSON.parse(match[0]) as NarrativeAdaptations
    await prisma.candidateNarrative.update({
      where: { id: narrative.id },
      data: { adaptations: parsed as unknown as object },
    })
    const isDefault = defaultNarrative?.id === narrative.id
    await awardAdaptationsBonus(candidateId, narrative.id, isDefault)
  } catch {
    // Malformed JSON from the model — leave the previous adaptations in place.
  }
}
