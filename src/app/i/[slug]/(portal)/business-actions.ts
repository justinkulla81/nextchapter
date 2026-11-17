'use server'

// Business Hub: what the organization enters for its employer pitch (incentives and office costs, with sources).

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { WorkspaceAccessError } from '@/lib/higher-ed/resolve'
import { prisma } from '@/lib/prisma'
import { pitchSettingsFromForm } from '@/lib/workforce/business-pitch'

export type BusinessResult = { error?: string; ok?: boolean; message?: string } | undefined

export async function savePitchSettings(slug: string, _prev: BusinessResult, formData: FormData): Promise<BusinessResult> {
  let ctx
  try {
    ctx = await requireWorkspace(slug, 'business', { write: true })
  } catch (e) {
    if (e instanceof WorkspaceAccessError) return { error: 'This is a read-only view, so nothing can be saved here.' }
    throw e
  }
  const settings = pitchSettingsFromForm(formData)
  const missingSource = settings.incentives.find((i) => !i.source)
  if (missingSource) return { error: `Add where "${missingSource.name}" comes from (a link or the agency's name), so the pitch can cite it.` }
  if (settings.officeCost && !settings.officeCost.source) return { error: 'Add where the office cost comes from (a broker report or listing), so the pitch can cite it.' }
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const features = { ...((inst.enabledFeatures as Record<string, unknown> | null) ?? {}), businessPitch: settings }
  await prisma.institution.update({ where: { id: ctx.institution.id }, data: { enabledFeatures: features as Prisma.InputJsonValue } })
  captureServerEvent(ctx.userId, 'business_pitch_settings_saved', {
    institutionId: ctx.institution.id,
    incentives: settings.incentives.length,
    officeCost: !!settings.officeCost,
    pitchLine: !!settings.pitchLine,
  })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved. The pitch uses these from now on.' }
}
