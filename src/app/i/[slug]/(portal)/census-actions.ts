'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { createOrgKey, revokeOrgKey } from '@/lib/census/api-keys'
import { readComms } from '@/lib/census/comms-settings'

export async function makeCollegeKey(slug: string, label: string): Promise<{ error?: string; token?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  if (ctx.institution.isDemo) return { error: 'Demo colleges can’t make real API keys.' }
  const r = await createOrgKey('institution', ctx.institution.id, label, ctx.email ?? ctx.userId)
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'census_api_key_created', { orgKind: 'institution', orgId: ctx.institution.id, keyId: r.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { token: r.token }
}

export async function turnOffCollegeKey(slug: string, keyId: string): Promise<{ error?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const r = await revokeOrgKey('institution', ctx.institution.id, keyId)
  if (r.ok) captureServerEvent(ctx.userId, 'census_api_key_revoked', { orgKind: 'institution', orgId: ctx.institution.id, keyId })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.error ? { error: r.error } : {}
}

export async function saveCollegeComms(slug: string, c: { joinReminders: boolean; accessEndingNotice: boolean }): Promise<{ error?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const ef = (inst.enabledFeatures ?? {}) as Record<string, unknown>
  const comms = { ...readComms(ef), joinReminders: !!c.joinReminders }
  await prisma.institution.update({ where: { id: ctx.institution.id }, data: { enabledFeatures: { ...ef, comms } } })
  captureServerEvent(ctx.userId, 'census_comms_saved', { orgKind: 'institution', orgId: ctx.institution.id, ...comms })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}
