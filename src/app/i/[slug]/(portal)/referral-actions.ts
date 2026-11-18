'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { institutionEntitlements } from '@/lib/plans/entitlements'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { cohortStats } from '@/lib/workforce/talent-cohorts'
import { canAnswer, canFinish, canSendReferral, canWithdraw, roundedPeople, validateAnswer, validateReferral } from '@/lib/workforce/partner-referrals'

export type ReferralResult = { ok?: boolean; message?: string; error?: string } | undefined

const done = (slug: string) => revalidatePath(`/i/${slug}`, 'layout')
const fields = (f: FormData) => ({ get: (k: string) => { const x = f.get(k); return typeof x === 'string' ? x : null } })

// Send one referral to a partner. About a need: the group (if any) is shown as a rounded count, never a list.
export async function sendReferral(slug: string, _prev: ReferralResult, f: FormData): Promise<ReferralResult> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const v = validateReferral(fields(f))
  if ('error' in v) return { error: v.error }
  const room = canSendReferral(institutionEntitlements({ plan: ctx.institution.plan }).referralLimit, await prisma.partnerReferral.count({ where: { institutionId: ctx.institution.id } }))
  if (!room.allowed) return { error: room.message ?? 'No room for another referral.' }
  const partner = await prisma.ecosystemPartner.findFirst({ where: { id: v.value.partnerId, institutionId: ctx.institution.id, status: { not: 'DECLINED' } }, select: { id: true, name: true } })
  if (!partner) return { error: 'That partner was not found.' }
  let cohortName: string | null = null
  let people: number | null = null
  if (v.value.cohortId) {
    const cohort = await prisma.talentCohort.findFirst({ where: { id: v.value.cohortId, institutionId: ctx.institution.id }, select: { name: true, industries: true, functions: true, levels: true, minWeeksOut: true } })
    if (!cohort) return { error: 'That cohort was not found.' }
    cohortName = cohort.name
    people = roundedPeople(cohortStats(await loadSupply(ctx.institution.id).catch(() => []), cohort).size)
  }
  let offeringTitle: string | null = null
  if (v.value.offeringId) {
    const o = await prisma.trainingOffering.findFirst({ where: { id: v.value.offeringId, institutionId: ctx.institution.id, status: 'ACTIVE' }, select: { title: true } })
    if (!o) return { error: 'That training was not found.' }
    offeringTitle = o.title
  }
  const r = await prisma.partnerReferral.create({ data: { institutionId: ctx.institution.id, partnerId: partner.id, title: v.value.title, message: v.value.message, cohortName, offeringTitle, people, dueDate: v.value.dueDate, createdBy: ctx.userId }, select: { id: true } })
  captureServerEvent(ctx.userId, 'partner_referral_sent', { institutionId: ctx.institution.id, referralId: r.id, partnerId: partner.id, hasCohort: !!cohortName, hasTraining: !!offeringTitle, hasPeople: people !== null })
  done(slug)
  return { ok: true, message: `Sent to ${partner.name}. They answer in their Partner Hub. You can also copy the message below.` }
}

// The sender marks an accepted referral done, or withdraws one that is still open.
export async function closeReferral(slug: string, id: string, to: 'DONE' | 'WITHDRAWN'): Promise<{ error?: string; message?: string }> {
  const ctx = await requireWorkspace(slug, 'wfhub', { write: true })
  const r = await prisma.partnerReferral.findFirst({ where: { id, institutionId: ctx.institution.id }, select: { status: true } })
  if (!r) return { error: 'That referral was not found.' }
  if (to === 'DONE' ? !canFinish(r.status) : !canWithdraw(r.status)) return { error: to === 'DONE' ? 'Only an accepted referral can be marked done.' : 'This referral can no longer be withdrawn.' }
  await prisma.partnerReferral.updateMany({ where: { id, institutionId: ctx.institution.id }, data: { status: to } })
  captureServerEvent(ctx.userId, 'partner_referral_closed', { institutionId: ctx.institution.id, referralId: id, to })
  done(slug)
  return { message: to === 'DONE' ? 'Marked done.' : 'Withdrawn.' }
}

// A person at the partner answers. The partner comes from their own access, never from the form.
export async function answerReferral(slug: string, id: string, _prev: ReferralResult, f: FormData): Promise<ReferralResult> {
  const ctx = await requireWorkspace(slug, 'partnerview', { write: true })
  const partnerId = ctx.partnerIds?.[0]
  if (!partnerId) return { error: 'We could not find your partner page. Ask the person who gave you access.' }
  const v = validateAnswer(fields(f))
  if ('error' in v) return { error: v.error }
  const ref = await prisma.partnerReferral.findFirst({ where: { id, institutionId: ctx.institution.id, partnerId }, select: { status: true } })
  if (!ref) return { error: 'That referral was not found.' }
  if (!canAnswer(ref.status)) return { error: 'This referral has already been answered.' }
  await prisma.partnerReferral.updateMany({ where: { id, institutionId: ctx.institution.id, partnerId, status: 'SENT' }, data: { status: v.value.status, answerNote: v.value.note, answeredAt: new Date(), answeredBy: ctx.userId } })
  captureServerEvent(ctx.userId, 'partner_referral_answered', { institutionId: ctx.institution.id, referralId: id, partnerId, status: v.value.status })
  done(slug)
  return { ok: true, message: v.value.status === 'ACCEPTED' ? 'Accepted. They will see your note.' : 'Declined. They will see your reason.' }
}
