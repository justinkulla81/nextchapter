import 'server-only'
import type { CoachingSettings, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Lazily creates the single settings row on first read — same effect as a
// seed script, without requiring one to have run first. The literal id
// ("singleton") is the primary key, so a second row can never be created
// even under a race; a concurrent create just fails and the retry read
// picks up the winner's row.
export async function getCoachingSettings(): Promise<CoachingSettings> {
  const existing = await prisma.coachingSettings.findUnique({ where: { id: 'singleton' } })
  if (existing) return existing
  try {
    return await prisma.coachingSettings.create({ data: { id: 'singleton' } })
  } catch {
    return prisma.coachingSettings.findUniqueOrThrow({ where: { id: 'singleton' } })
  }
}

// Updates the single settings row in place and writes a field-level diff to
// AdminSettingsChangeLog — "every change is logged with actor + timestamp"
// (§A5.3), without versioning the settings object itself (see the schema
// comment on CoachingSettings for why that's the right call here).
export async function updateCoachingSettings(
  data: Prisma.CoachingSettingsUpdateInput,
  actor: string
): Promise<CoachingSettings> {
  const before = await getCoachingSettings()
  const after = await prisma.coachingSettings.update({ where: { id: 'singleton' }, data })

  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(data) as (keyof CoachingSettings)[]) {
    const fromVal = before[key]
    const toVal = after[key]
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      diff[key] = { from: fromVal, to: toVal }
    }
  }

  if (Object.keys(diff).length > 0) {
    await prisma.adminSettingsChangeLog.create({
      data: { scope: 'COACHING', actor, diff: diff as Prisma.InputJsonValue },
    })
  }

  return after
}
