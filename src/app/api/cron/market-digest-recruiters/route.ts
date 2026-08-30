import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestRecruiterEmail } from '@/lib/email/send-market-digest-recruiter'
import { recordDigestSend, getDigestNuggets, markItemsSent } from '@/lib/admin/digest-composer'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const recruiters = await prisma.recruiter.findMany({
    where: { isSampleData: false, marketDigestOptedOut: false },
    select: { id: true, fullName: true, workEmail: true, specialty: true },
  })

  const nugget = (await getDigestNuggets('RECRUITER', 1))[0] ?? null

  let sentCount = 0
  for (const recruiter of recruiters) {
    try {
      if (!recruiter.specialty && !nugget) continue

      const marketConditions = recruiter.specialty
        ? await getMarketConditions({ roleType: recruiter.specialty, primaryFunction: null, city: null, state: null })
        : null

      const result = await sendMarketDigestRecruiterEmail(recruiter, marketConditions, nugget)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Recruiter market digest failed for recruiter', recruiter.id, error)
    }
  }

  if (sentCount > 0) {
    await recordDigestSend('recruiter', sentCount, nugget ? [nugget.id] : [])
    if (nugget) await markItemsSent([nugget.id], 'RECRUITER')
  }

  return NextResponse.json({ checked: recruiters.length, sent: sentCount })
}
