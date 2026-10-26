'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { parseNpsAudience, resolveNpsRespondent } from '@/lib/nps/respondent'
import { NPS_COMMENT_MAX, isValidNpsScore, npsCategory } from '@/lib/nps/score'

export type NpsActionResult = { ok: true; responseId?: string } | { ok: false; error: string }

const SIGNED_OUT: NpsActionResult = { ok: false, error: 'Your session ended. Sign in again to answer.' }
const label = (r: { name: string; orgName: string | null }) => [r.name, r.orgName].filter(Boolean).join(', ')
const cleanPath = (p: unknown) => (typeof p === 'string' ? p.trim().slice(0, 300) : '') || null

/** Saves the score the moment it is picked, so a closed tab before the comment loses nothing. */
export async function submitNpsScore(audienceRaw: string, score: number, contextPath: string): Promise<NpsActionResult> {
  if (!isValidNpsScore(score)) return { ok: false, error: 'Pick a number from 0 to 10.' }
  const who = await resolveNpsRespondent(parseNpsAudience(audienceRaw))
  if (!who) return SIGNED_OUT
  const row = await prisma.npsResponse.create({
    data: { audience: who.audience, respondentId: who.id, respondentLabel: label(who), score, contextPath: cleanPath(contextPath) },
    select: { id: true },
  })
  captureServerEvent(who.id, 'nps_score_submitted', {
    responseId: row.id, audience: who.audience, score, category: npsCategory(score), page: cleanPath(contextPath),
  })
  return { ok: true, responseId: row.id }
}

/** The optional "why", added to the response just saved. Only the person who gave the score can add it. */
export async function addNpsComment(audienceRaw: string, responseId: string, comment: string): Promise<NpsActionResult> {
  const who = await resolveNpsRespondent(parseNpsAudience(audienceRaw))
  if (!who) return SIGNED_OUT
  const text = comment.replace(/\r\n/g, '\n').trim().slice(0, NPS_COMMENT_MAX)
  if (!text) return { ok: false, error: 'Write a few words, or skip this step.' }
  const updated = await prisma.npsResponse.updateMany({
    where: { id: responseId, audience: who.audience, respondentId: who.id, score: { not: null } },
    data: { comment: text },
  })
  if (updated.count === 0) return { ok: false, error: 'We could not find your answer. Please try again.' }
  captureServerEvent(who.id, 'nps_comment_added', { responseId, audience: who.audience, length: text.length })
  return { ok: true, responseId }
}

/** "Not now": records that it was shown and put away, which starts the shorter cooldown. */
export async function dismissNps(audienceRaw: string, contextPath: string): Promise<NpsActionResult> {
  const who = await resolveNpsRespondent(parseNpsAudience(audienceRaw))
  if (!who) return SIGNED_OUT
  const row = await prisma.npsResponse.create({
    data: { audience: who.audience, respondentId: who.id, respondentLabel: label(who), score: null, contextPath: cleanPath(contextPath) },
    select: { id: true },
  })
  captureServerEvent(who.id, 'nps_dismissed', { responseId: row.id, audience: who.audience, page: cleanPath(contextPath) })
  return { ok: true, responseId: row.id }
}
