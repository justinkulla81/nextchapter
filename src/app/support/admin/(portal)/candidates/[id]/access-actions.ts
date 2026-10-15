'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { setGrantOn, setGrantSessions } from '@/lib/access/grants'

type Res = { error?: string; ok?: boolean }

export async function adminSetGrantOn(candidateId: string, grantId: string, on: boolean): Promise<Res> {
  const admin = await requireAdmin()
  await setGrantOn(grantId, on, `admin:${admin.email}`)
  captureServerEvent(candidateId, 'admin_access_grant_set', { candidateId, grantId, on, by: admin.email })
  revalidatePath(`/support/admin/candidates/${candidateId}`)
  return { ok: true }
}

export async function adminSetGrantSessions(candidateId: string, grantId: string, sessions: number | null): Promise<Res> {
  const admin = await requireAdmin()
  if (sessions !== null && !(sessions >= 0 && sessions <= 200)) return { error: 'Sessions must be between 0 and 200, or blank for no limit.' }
  await setGrantSessions(grantId, sessions, `admin:${admin.email}`)
  captureServerEvent(candidateId, 'admin_access_sessions_set', { candidateId, grantId, sessions, by: admin.email })
  revalidatePath(`/support/admin/candidates/${candidateId}`)
  return { ok: true }
}

export async function adminGiveAccess(candidateId: string, feature: 'coaching' | 'recruiters', sessions: number | null, days: number | null): Promise<Res> {
  const admin = await requireAdmin()
  if (feature === 'coaching' && sessions !== null && !(sessions >= 1 && sessions <= 200)) return { error: 'Sessions must be between 1 and 200, or blank for no limit.' }
  if (days !== null && !(days >= 1 && days <= 730)) return { error: 'Days must be between 1 and 730, or blank for no end.' }
  await prisma.accessGrant.create({
    data: { candidateId, feature, source: 'admin', sessionsTotal: feature === 'coaching' ? sessions : null, endsAt: days ? new Date(Date.now() + days * 86_400_000) : null, createdBy: `admin:${admin.email}` },
  })
  captureServerEvent(candidateId, 'admin_access_given', { candidateId, feature, sessions, days, by: admin.email })
  revalidatePath(`/support/admin/candidates/${candidateId}`)
  return { ok: true }
}
