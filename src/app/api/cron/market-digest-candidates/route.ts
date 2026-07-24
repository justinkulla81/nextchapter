import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestCandidateEmail } from '@/lib/email/send-market-digest-candidate'
import { recordDigestSend, getDigestNugget } from '@/lib/admin/digest-composer'

// Weekly market-conditions email — separate day from community-coaching-digest
// (Saturday) to avoid inbox pile-up. Reuses the same per-candidate
// getMarketConditions() call already used inline in Hireability Report
// generation, rather than recomputing anything new.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, marketDigestOptedOut: false },
    select: {
      id: true,
      userId: true,
      firstName: true,
      notificationTier: true,
      targetRoleType: true,
      primaryFunction: true,
      currentCity: true,
      currentState: true,
    },
  })

  // One shared persona nugget for this run — not per-candidate matched
  // (no per-candidate persona field exists yet); a simple, honest scope
  // trim rather than building new candidate-persona classification.
  const nugget = await getDigestNugget('PERSONA_RESEARCH')

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue

      const marketConditions = await getMarketConditions({
        roleType: candidate.targetRoleType,
        primaryFunction: candidate.primaryFunction,
        city: candidate.currentCity,
        state: candidate.currentState,
      })

      if (!marketConditions.dataAvailable && !nugget) continue

      const result = await sendMarketDigestCandidateEmail(candidate, marketConditions, nugget)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Candidate market digest failed for candidate', candidate.id, error)
    }
  }

  if (sentCount > 0) {
    await recordDigestSend('candidate', sentCount, nugget ? [nugget.id] : [])
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
