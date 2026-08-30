import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCandidatesLookingForYourRoles } from '@/lib/talent/candidate-discovery'
import { candidateDisplayName } from '@/lib/talent/candidate-identity'
import { sendMarketDigestEmployerEmail } from '@/lib/email/send-market-digest-employer'
import { recordDigestSend, getDigestNuggets, markItemsSent } from '@/lib/admin/digest-composer'

const MAX_MATCH_LINES = 3

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const employers = await prisma.employerProfile.findMany({
    where: { isSampleData: false, marketDigestOptedOut: false },
    select: { id: true, userId: true, companyName: true, contactName: true },
  })

  const nugget = (await getDigestNuggets('EMPLOYER', 1))[0] ?? null

  let sentCount = 0
  for (const employer of employers) {
    try {
      // Same "candidates looking for your roles" match used on the Talent
      // dashboard home — real people who opted in and match what this
      // employer is hiring for, not an external job-market count that says
      // nothing about who's actually available to them.
      const matches = await getCandidatesLookingForYourRoles(employer.id, MAX_MATCH_LINES)
      const matchLines = matches.map((m) => ({
        displayName: candidateDisplayName(m.candidate, m.locked),
        roleTitle: m.roleTitle,
        matchLabel: m.match.label,
        locked: m.locked,
      }))

      if (matchLines.length === 0 && !nugget) continue

      const result = await sendMarketDigestEmployerEmail(employer, matchLines, nugget)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Employer market digest failed for employer', employer.id, error)
    }
  }

  if (sentCount > 0) {
    await recordDigestSend('employer', sentCount, nugget ? [nugget.id] : [])
    if (nugget) await markItemsSent([nugget.id], 'EMPLOYER')
  }

  return NextResponse.json({ checked: employers.length, sent: sentCount })
}
