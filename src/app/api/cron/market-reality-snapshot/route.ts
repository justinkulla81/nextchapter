import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { generateMarketRealitySnapshot } from '@/lib/scoring/market-reality-snapshot'

// Fires Monday afternoon (see vercel.json) — well after auto-assign-sprint's
// ~5am ET run, so every candidate already has this week's Search Actions
// auto-assigned before this week's Current Market Reality snapshot is
// generated and archived. Idempotent per (candidateId, weekStartDate).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())

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
