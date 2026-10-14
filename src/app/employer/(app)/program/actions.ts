'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { PROGRAM_FEATURES, readProgramSettings, type ProgramFeatureKey } from '@/lib/employer/program-settings'

export type ProgramFormState = { error?: string; ok?: string } | undefined

export async function saveProgramDetails(_prev: ProgramFormState, f: FormData): Promise<ProgramFormState> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change the program.' }
  const name = String(f.get('programBrandName') ?? '').trim().slice(0, 80) || null
  const welcome = String(f.get('welcome') ?? '').trim().slice(0, 1000) || null
  const org = await prisma.outplacementEmployerOrg.findUniqueOrThrow({ where: { id: orgUser.orgId }, select: { programSettings: true } })
  const s = readProgramSettings(org.programSettings)
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programBrandName: name, programSettings: { ...s, welcome } } })
  captureServerEvent(orgUser.userId, 'outplacement_program_details_saved', { orgId: orgUser.orgId, named: !!name, welcome: !!welcome })
  revalidatePath('/employer', 'layout')
  return { ok: 'Saved. Your people see this on their NextChapter dashboard.' }
}

export async function setProgramFeature(key: ProgramFeatureKey, on: boolean): Promise<{ error?: string; ok?: boolean }> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can change the program.' }
  if (!PROGRAM_FEATURES.some((x) => x.key === key)) return { error: 'Unknown service.' }
  const org = await prisma.outplacementEmployerOrg.findUniqueOrThrow({ where: { id: orgUser.orgId }, select: { programSettings: true } })
  const s = readProgramSettings(org.programSettings)
  await prisma.outplacementEmployerOrg.update({ where: { id: orgUser.orgId }, data: { programSettings: { ...s, features: { ...s.features, [key]: on } } } })
  captureServerEvent(orgUser.userId, 'outplacement_program_feature_switched', { orgId: orgUser.orgId, feature: key, on })
  revalidatePath('/employer/program')
  return { ok: true }
}
