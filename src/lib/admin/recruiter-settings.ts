import 'server-only'
import type { Prisma, RecruiterSettings } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Same lazy-singleton pattern as getCoachingSettings — see that file.
export async function getRecruiterSettings(): Promise<RecruiterSettings> {
  const existing = await prisma.recruiterSettings.findUnique({ where: { id: 'singleton' } })
  if (existing) return existing
  try {
    return await prisma.recruiterSettings.create({ data: { id: 'singleton' } })
  } catch {
    return prisma.recruiterSettings.findUniqueOrThrow({ where: { id: 'singleton' } })
  }
}

export async function updateRecruiterSettings(
  data: Prisma.RecruiterSettingsUpdateInput,
  actor: string
): Promise<RecruiterSettings> {
  const before = await getRecruiterSettings()
  const after = await prisma.recruiterSettings.update({ where: { id: 'singleton' }, data })

  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(data) as (keyof RecruiterSettings)[]) {
    const fromVal = before[key]
    const toVal = after[key]
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      diff[key] = { from: fromVal, to: toVal }
    }
  }

  if (Object.keys(diff).length > 0) {
    await prisma.adminSettingsChangeLog.create({
      data: { scope: 'RECRUITER', actor, diff: diff as Prisma.InputJsonValue },
    })
  }

  return after
}
