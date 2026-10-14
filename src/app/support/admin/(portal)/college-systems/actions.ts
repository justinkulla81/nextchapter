'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export type SystemFormState = { error?: string; ok?: string } | undefined
const P = '/support/admin/college-systems'

export async function createSystem(_prev: SystemFormState, f: FormData): Promise<SystemFormState> {
  const admin = await requireAdmin()
  const name = String(f.get('name') ?? '').trim()
  const slug = String(f.get('slug') ?? '').trim().toLowerCase()
  if (!name) return { error: 'Give the system a name.' }
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return { error: 'The short name is 2–40 lowercase letters, numbers or dashes.' }
  if (await prisma.institutionSystem.findUnique({ where: { slug }, select: { id: true } })) return { error: 'That short name is taken.' }
  const s = await prisma.institutionSystem.create({ data: { name, slug }, select: { id: true } })
  captureServerEvent(admin.email ?? 'admin', 'he_system_created', { systemId: s.id })
  revalidatePath(P)
  return { ok: `Created ${name}.` }
}

export async function setCampusSystem(institutionId: string, systemId: string | null): Promise<{ error?: string; message?: string }> {
  const admin = await requireAdmin()
  await prisma.institution.update({ where: { id: institutionId }, data: { systemId } })
  captureServerEvent(admin.email ?? 'admin', 'he_system_campus_set', { institutionId, systemId })
  revalidatePath(P)
  return { message: systemId ? 'Added.' : 'Removed from the system.' }
}

export async function addSystemUser(systemId: string, _prev: SystemFormState, f: FormData): Promise<SystemFormState> {
  const admin = await requireAdmin()
  const email = String(f.get('email') ?? '').trim().toLowerCase()
  const fullName = String(f.get('fullName') ?? '').trim() || null
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' }
  await prisma.institutionSystemUser.upsert({ where: { systemId_email: { systemId, email } }, create: { systemId, email, fullName }, update: { revokedAt: null, fullName } })
  captureServerEvent(admin.email ?? 'admin', 'he_system_user_added', { systemId })
  revalidatePath(P)
  return { ok: `${email} can now sign in and open /systems.` }
}

export async function revokeSystemUser(id: string): Promise<{ error?: string; message?: string }> {
  const admin = await requireAdmin()
  await prisma.institutionSystemUser.update({ where: { id }, data: { revokedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'he_system_user_revoked', { id })
  revalidatePath(P)
  return { message: 'Removed.' }
}
