'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { captureServerEvent } from '@/lib/posthog/server'
import { coachSetSessions, createCoachCode, revokeCoachCode } from '@/lib/access/grants'

export type CoachAccessState = { error?: string; ok?: string; code?: string } | undefined

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : Number(s)
}

export async function makeCode(_prev: CoachAccessState, fd: FormData): Promise<CoachAccessState> {
  const coach = await getCurrentCoach()
  const sessions = num(fd.get('sessions'))
  const validDays = num(fd.get('validDays'))
  const maxUses = num(fd.get('maxUses')) ?? 1
  if (sessions === null || Number.isNaN(sessions)) return { error: 'Enter how many sessions the code gives.' }
  if (validDays !== null && !(validDays >= 1 && validDays <= 730)) return { error: 'Days must be between 1 and 730, or leave it blank for no end.' }
  const r = await createCoachCode(coach.id, { sessions, validDays, maxUses, note: String(fd.get('note') ?? '').trim() || null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(coach.id, 'coach_access_code_created', { coachId: coach.id, codeId: r.id, sessions, validDays, maxUses })
  revalidatePath('/support/coach/access')
  return { ok: 'Code ready. Send it to your client.', code: r.code }
}

export async function turnOffCode(codeId: string): Promise<{ error?: string; ok?: boolean }> {
  const coach = await getCurrentCoach()
  const r = await revokeCoachCode(coach.id, codeId)
  if (r.ok) captureServerEvent(coach.id, 'coach_access_code_revoked', { coachId: coach.id, codeId })
  revalidatePath('/support/coach/access')
  return r
}

export async function setSessionsLeft(_prev: CoachAccessState, fd: FormData): Promise<CoachAccessState> {
  const coach = await getCurrentCoach()
  const candidateId = String(fd.get('candidateId') ?? '')
  const left = num(fd.get('sessionsLeft'))
  const validDays = num(fd.get('validDays'))
  if (left === null || Number.isNaN(left)) return { error: 'Enter the sessions they have left.' }
  const r = await coachSetSessions(coach.id, candidateId, left, validDays, `coach:${coach.id}`)
  if (r.error) return { error: r.error }
  captureServerEvent(coach.id, 'coach_client_sessions_set', { coachId: coach.id, candidateId, sessionsLeft: left, validDays })
  revalidatePath('/support/coach/access')
  return { ok: 'Saved.' }
}

export async function saveSchedulingUrl(_prev: CoachAccessState, fd: FormData): Promise<CoachAccessState> {
  const coach = await getCurrentCoach()
  const raw = String(fd.get('schedulingUrl') ?? '').trim()
  if (raw) {
    try {
      const u = new URL(raw)
      if (u.protocol !== 'https:') return { error: 'Use a link that starts with https://' }
    } catch {
      return { error: 'That doesn’t look like a link. Paste the full address, like https://calendly.com/you' }
    }
  }
  await prisma.coach.update({ where: { id: coach.id }, data: { schedulingUrl: raw || null } })
  captureServerEvent(coach.id, 'coach_scheduling_url_saved', { coachId: coach.id, hasUrl: !!raw })
  revalidatePath('/support/coach/access')
  return { ok: raw ? 'Saved. Your clients see a “Book a session” button.' : 'Removed.' }
}
