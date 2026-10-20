import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { sumEffortMinutes } from '@/lib/scoring/effort-minutes'
import { unlockStatus, type UnlockStatus } from './unlock'

/** Fail-soft read: a missing table must never take a page down. */
async function soft<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work
  } catch (error) {
    console.error('Strategy unlock: a read failed (is the EffortCycle table applied?)', error)
    return fallback
  }
}

/** Members who registered before this date start their first cycle the first time it is read, not at registration. */
export const EFFORT_LAUNCH_DATE = new Date('2026-10-19T00:00:00Z')

async function getCycleStart(candidateId: string, profile: { registrationCompletedAt: Date | null; createdAt: Date }): Promise<Date> {
  const row = await soft(prisma.effortCycle.findUnique({ where: { candidateId }, select: { startedAt: true } }), null)
  if (row) return row.startedAt
  const registered = profile.registrationCompletedAt ?? profile.createdAt
  // New members: the window runs from registration, so effort already put in counts.
  if (registered >= EFFORT_LAUNCH_DATE) return registered
  // Long-time members would otherwise unlock instantly on years of history (and trigger many model
  // calls at once), so their first cycle starts now.
  const startedAt = new Date()
  await soft(prisma.effortCycle.createMany({ data: [{ candidateId, startedAt }], skipDuplicates: true }), null)
  return startedAt
}

/** Minutes of search effort since the member's last strategy (whole weekly plans from that week on) and whether that earns the next one. */
export async function getUnlockStatus(candidateId: string): Promise<UnlockStatus> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { registrationCompletedAt: true, createdAt: true } })
  const since = await getCycleStart(candidateId, profile)
  const sprints = await prisma.weeklySprint.findMany({ where: { candidateId, weekStartDate: { gte: getMondayOfWeek(since) } }, select: { committedActions: true } })
  return unlockStatus(sumEffortMinutes(sprints), { cycleStartedAt: since, now: new Date() })
}

/** Starts the next cycle once the member has used their unlock. Only this resets the window. */
export async function startNewCycle(candidateId: string): Promise<void> {
  try {
    const startedAt = new Date()
    await prisma.effortCycle.upsert({ where: { candidateId }, create: { candidateId, startedAt }, update: { startedAt } })
  } catch (error) {
    console.error('Strategy unlock: could not start the next cycle', error)
  }
}
