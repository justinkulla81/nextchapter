'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { createOrgKey, revokeOrgKey } from '@/lib/census/api-keys'
import { readProgramSettings } from '@/lib/employer/program-settings'

export async function makeEmployerKey(label: string): Promise<{ error?: string; token?: string }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can make keys.' }
  const r = await createOrgKey('outplacement', orgUser.orgId, label, `employer:${orgUser.userId}`)
  if ('error' in r) return { error: r.error }
  captureServerEvent(orgUser.userId, 'census_api_key_created', { orgKind: 'outplacement', orgId: orgUser.orgId, keyId: r.id })
  revalidatePath('/employer/connect')
  return { token: r.token }
}

export async function turnOffEmployerKey(keyId: string): Promise<{ error?: string }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can turn keys off.' }
  const r = await revokeOrgKey('outplacement', orgUser.orgId, keyId)
  if (r.ok) captureServerEvent(orgUser.userId, 'census_api_key_revoked', { orgKind: 'outplacement', orgId: orgUser.orgId, keyId })
  revalidatePath('/employer/connect')
  return r.error ? { error: r.error } : {}
}

export async function saveEmployerComms(c: { joinReminders: boolean; accessEndingNotice: boolean }): Promise<{ error?: string }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change emails.' }
  const org = await prisma.outplacementEmployerOrg.findUniqueOrThrow({ where: { id: orgUser.orgId }, select: { programSettings: true } })
  const s = readProgramSettings(org.programSettings)
  const comms = { joinReminders: !!c.joinReminders, accessEndingNotice: !!c.accessEndingNotice }
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programSettings: { ...s, comms } } })
  captureServerEvent(orgUser.userId, 'census_comms_saved', { orgKind: 'outplacement', orgId: orgUser.orgId, ...comms })
  revalidatePath('/employer/connect')
  return {}
}
