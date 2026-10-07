import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refreshActivityStreak } from '@/lib/daily/activity-streak'

export const maxDuration = 300

// Nightly: recompute every candidate's streak from their activity, so the
// stored currentStreak read by emails, the community feed and unlock tiers
// drops to 0 after a missed day instead of waiting for the candidate's next
// visit to notice.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const candidates = await prisma.candidateProfile.findMany({
    where: { isSampleData: false, isSystemAccount: false, registrationCompletedAt: { not: null } },
    select: { id: true },
  })
  let updated = 0
  let failed = 0
  let next = 0
  async function worker() {
    while (next < candidates.length) {
      const c = candidates[next++]
      try { await refreshActivityStreak(c.id); updated++ } catch (e) { failed++; console.error('Streak refresh failed', c.id, e) }
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker))
  return NextResponse.json({ candidates: candidates.length, updated, failed })
}
