import 'server-only'
import { prisma } from '@/lib/prisma'

const TASKS_SHOWN = 3

/** The first few core tasks for each occupation: what the job does day to day. Empty if none are loaded. */
export async function getCoreTasks(socCodes: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (socCodes.length === 0) return out
  try {
    const rows = await prisma.occupationTask.findMany({
      where: { socCode: { in: socCodes }, taskType: 'CORE' },
      orderBy: [{ socCode: 'asc' }, { taskId: 'asc' }],
      select: { socCode: true, text: true },
    })
    for (const r of rows) {
      const list = out.get(r.socCode) ?? []
      if (list.length < TASKS_SHOWN) out.set(r.socCode, [...list, r.text])
    }
  } catch (error) {
    // The table may not exist yet; the card just leaves the section out.
    console.error('Occupation tasks unavailable:', error)
  }
  return out
}
