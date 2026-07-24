import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestEmployerEmail } from '@/lib/email/send-market-digest-employer'
import { recordDigestSend, getDigestNugget } from '@/lib/admin/digest-composer'

const MAX_ROLE_LINES = 3

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const employers = await prisma.employerProfile.findMany({
    where: { isSampleData: false, marketDigestOptedOut: false },
    select: {
      id: true,
      userId: true,
      companyName: true,
      contactName: true,
      roleProfiles: {
        where: { isActive: true },
        select: { roleTitle: true, primaryFunction: true, locationRequirement: true },
      },
    },
  })

  const nugget = await getDigestNugget('MARKET_BRIEF')

  let sentCount = 0
  for (const employer of employers) {
    try {
      const uniqueRoles = new Map<string, { roleTitle: string; primaryFunction: string | null; locationRequirement: string | null }>()
      for (const role of employer.roleProfiles) {
        const key = `${role.roleTitle}|${role.locationRequirement ?? ''}`
        if (!uniqueRoles.has(key)) uniqueRoles.set(key, role)
      }

      const roleEntries = Array.from(uniqueRoles.values()).slice(0, MAX_ROLE_LINES)
      const roleLines = await Promise.all(
        roleEntries.map(async (r) => {
          const mc = await getMarketConditions({
            roleType: r.roleTitle,
            primaryFunction: r.primaryFunction,
            city: null,
            state: r.locationRequirement,
          })
          return { roleTitle: r.roleTitle, adzunaCount: mc.adzunaCount }
        })
      )

      if (roleLines.length === 0 && !nugget) continue

      const result = await sendMarketDigestEmployerEmail(employer, roleLines, nugget)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Employer market digest failed for employer', employer.id, error)
    }
  }

  if (sentCount > 0) {
    await recordDigestSend('employer', sentCount, nugget ? [nugget.id] : [])
  }

  return NextResponse.json({ checked: employers.length, sent: sentCount })
}
