import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { isLockTimePassed } from '@/lib/weekly/pt-time'
import { generateMarketRealitySnapshot } from '@/lib/scoring/market-reality-snapshot'

// Fires shortly after auto-assign-sprint (see vercel.json) — right after
// that week's Weekly Search Sprint locks (Monday 12:01pm PT), so every
// candidate already has a committed Sprint (self-set or auto-assigned)
// before this week's Market Reality Grade snapshot is generated and
// archived. Idempotent per (candidateId, weekStartDate).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())
  if (!isLockTimePassed(weekStartDate)) {
    return NextResponse.json({ skipped: 'Monday 12:01pm PT lock has not passed yet' })
  }

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null } },
    select: { id: true },
  })

  let generated = 0
  for (const candidate of eligible) {
    try {
      await generateMarketRealitySnapshot(candidate.id, weekStartDate)
      generated += 1
    } catch (error) {
      console.error('Market Reality snapshot failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, generated })
}
