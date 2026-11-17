import 'server-only'
import { prisma } from '@/lib/prisma'
import { readLocal, localArea, isInArea } from './local'

const NARROW = /seminary|theological|nursing|medical|beauty|barber|cosmetology|massage|bible/i

export async function nearbyColleges(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true, profile: true } })
  const local = readLocal(inst.enabledFeatures)
  if (!local) return []
  const area = await localArea(local)
  if (!area) return []
  // Both sides of a border: every state the region covers.
  const states = [...new Set([local.anchorState, ...((inst.profile as { region?: { areas?: { state: string }[] } } | null)?.region?.areas ?? []).map((a) => a.state)])]
  const rows = await prisma.collegeProfile.findMany({
    where: { state: { in: states }, enrollment: { gt: 400 } },
    orderBy: { enrollment: 'desc' },
    take: 300,
    select: { unitid: true, name: true, city: true, state: true, control: true, level: true, enrollment: true, hasExecEd: true, hasRetraining: true, aiPrograms: true, website: true },
  })
  return rows.filter((c) => isInArea(area, c.city, c.state) && !NARROW.test(c.name)).slice(0, 10)
}

