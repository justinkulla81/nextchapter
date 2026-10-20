'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import { OUTCOMES, cleanConversation } from '@/lib/review-prep/conversation'

export type ConversationFormState = {
  error?: string
  ok?: boolean
  // Kept so a mistake never clears what the member typed.
  values?: { id: string; kind: string; scheduledFor: string; askAmount: string; askLevel: string; reasons: string[]; walkAway: string }
} | null

async function me() {
  const user = await getCurrentUser()
  if (!user) return null
  return prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
}

export async function saveConversation(_prev: ConversationFormState, formData: FormData): Promise<ConversationFormState> {
  const profile = await me()
  const values = {
    id: String(formData.get('id') ?? ''),
    kind: String(formData.get('kind') ?? ''),
    scheduledFor: String(formData.get('scheduledFor') ?? ''),
    askAmount: String(formData.get('askAmount') ?? ''),
    askLevel: String(formData.get('askLevel') ?? ''),
    reasons: [1, 2, 3].map((n) => String(formData.get(`reason${n}`) ?? '')),
    walkAway: String(formData.get('walkAway') ?? ''),
  }
  if (!profile) return { error: 'Your session ended. Sign in again, and what you typed will still be here.', values }

  const cleaned = cleanConversation(values)
  if (!cleaned.ok) return { error: cleaned.error, values }
  const v = cleaned.value

  if (values.id) {
    const mine = await prisma.careerConversation.findFirst({ where: { id: values.id, candidateId: profile.id }, select: { id: true } })
    if (!mine) return { error: 'We could not find that conversation. Reload the page and try again.', values }
    await prisma.careerConversation.update({ where: { id: mine.id }, data: { ...v } })
  } else {
    await prisma.careerConversation.create({ data: { candidateId: profile.id, ...v } })
  }
  captureServerEvent(profile.id, 'career_conversation_saved', {
    kind: v.kind,
    edited: !!values.id,
    hasAmount: v.askAmount !== null,
    hasLevel: v.askLevel !== null,
    reasonCount: v.reasons.length,
    hasWalkAway: v.walkAway !== null,
    scheduled: v.scheduledFor !== null,
  })
  revalidatePath('/dashboard/review-prep')
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function recordOutcome(id: string, outcome: string, note: string): Promise<{ error?: string }> {
  const profile = await me()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  const o = OUTCOMES.find((x) => x.key === outcome)?.key
  if (!o) return { error: 'Choose how it went.' }
  const convo = await prisma.careerConversation.findFirst({ where: { id, candidateId: profile.id }, select: { id: true, kind: true } })
  if (!convo) return { error: 'We could not find that conversation. Reload the page and try again.' }
  await prisma.careerConversation.update({ where: { id: convo.id }, data: { outcome: o, outcomeNote: note.trim().slice(0, 1000) || null, decidedAt: new Date() } })
  captureServerEvent(profile.id, 'career_conversation_outcome', { kind: convo.kind, outcome: o, hasNote: note.trim().length > 0 })
  revalidatePath('/dashboard/review-prep')
  return {}
}
