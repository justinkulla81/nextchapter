'use server'

import { answerCheckIn, findCheckInForAnswer, isCheckInAnswer } from '@/lib/higher-ed/checkins'
import { checkInUnlocks, cleanDetails, saveDetailsToMember, type Unlocks } from '@/lib/higher-ed/checkin-unlocks'
import { prisma } from '@/lib/prisma'
import { demoCheckInMember } from '@/lib/higher-ed/demo-checkin'
import { functionFromText } from '@/lib/higher-ed/checkin-details'
import { pivotTargetWrite } from '@/lib/journey/pivot-target'
import { captureServerEvent } from '@/lib/posthog/server'

// "Send my answer" on the check-in page. The email's token proves who's
// answering; the answer is recorded only on this click, never on page load.
export async function submitCheckInAnswer(slug: string, checkInId: string, token: string, answer: string): Promise<{ ok?: true; error?: string }> {
  if (!isCheckInAnswer(answer)) return { error: 'Pick one of the answers.' }
  const c = await findCheckInForAnswer(slug, checkInId, token)
  if (!c) return { error: 'This check-in link isn’t valid any more. Your alumni office can send a new one.' }
  await answerCheckIn({ checkInId, memberId: c.member.id, answer })
  return { ok: true }
}

// The step after the answer: what the alum chose to tell the college (all optional), then what that unlocks.
export async function saveCheckInDetails(
  slug: string,
  checkInId: string,
  token: string,
  raw: Record<string, unknown>,
): Promise<{ unlocks?: Unlocks; error?: string }> {
  const c = await findCheckInForAnswer(slug, checkInId, token)
  if (!c) return { error: 'This check-in link isn’t valid any more. Your alumni office can send a new one.' }
  const json = (c.responseJson ?? {}) as { answer?: unknown; previous?: unknown }
  if (!isCheckInAnswer(json.answer)) return { error: 'Send your answer first.' }
  const details = cleanDetails(json.answer, raw)
  await prisma.checkIn.update({ where: { id: checkInId }, data: { responseJson: { ...(json as object), details } } })
  await saveDetailsToMember(c.member.id, details)
  // A joined alum moving to another field: the field they named becomes their target, so the skills bridge measures
  // against the jobs they want (pivotTargetWrite keeps the older flag in step).
  const targetFn = json.answer === 'looking' && details.distance && details.distance !== 'same' ? functionFromText(details.target) : null
  if (targetFn && c.member.candidateId) await prisma.candidateProfile.update({ where: { id: c.member.candidateId }, data: pivotTargetWrite(targetFn) }).catch((err) => console.error('[checkin] target', err))
  const joined = !!c.member.candidateId && (c.member.status === 'CLAIMED' || c.member.status === 'ACTIVE')
  const unlocks = await checkInUnlocks({ memberId: c.member.id, answer: json.answer, details, joined, joinHref: `/i/${slug}/join?t=${encodeURIComponent(token)}` })
  captureServerEvent(c.member.candidateId ?? `member:${c.member.id}`, 'he_checkin_details_saved', {
    institutionId: c.member.institution.id,
    checkInId,
    answer: json.answer,
    fields: Object.keys(details),
    distance: details.distance ?? null,
    targetFunction: targetFn,
    unlocked: unlocks.cards.map((x) => x.key),
  })
  return { unlocks }
}

// The demo walkthrough (/i/[slug]/checkin/demo): the same steps for the demo's sample alum, recording nothing.
// The alum comes from the demo bar's choice on the server, never from the client.
export async function saveDemoCheckInDetails(slug: string, alum: string | null, answer: string, raw: Record<string, unknown>): Promise<{ unlocks?: Unlocks; error?: string }> {
  if (!isCheckInAnswer(answer)) return { error: 'Pick one of the answers.' }
  const demo = await demoCheckInMember(slug, alum)
  if (!demo) return { error: 'This walkthrough is only on a demo.' }
  const details = cleanDetails(answer, raw)
  const unlocks = await checkInUnlocks({ memberId: demo.memberId, answer, details, joined: true, joinHref: `/i/${slug}/candidate`, assume: true })
  captureServerEvent(`demo:${slug}`, 'he_demo_checkin_answered', { slug, alum, answer, fields: Object.keys(details), distance: details.distance ?? null, unlocked: unlocks.cards.map((x) => x.key) })
  return { unlocks }
}
