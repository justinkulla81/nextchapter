import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestCoachEmail } from '@/lib/email/send-market-digest-coach'
import { recordDigestSend, getDigestNuggets, markItemsSent } from '@/lib/admin/digest-composer'

const MAX_ROLE_LINES = 3

// Aggregate-only — never joins in any individual client's identity or
// score, only the deduped set of target roles across a coach's clients.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const coaches = await prisma.coach.findMany({
    where: { isSampleData: false, marketDigestOptedOut: false },
    select: {
      id: true,
      fullName: true,
      workEmail: true,
      accessToken: true,
      clients: { select: { targetRoleType: true, primaryFunction: true, currentCity: true, currentState: true } },
    },
  })

  const nugget = (await getDigestNuggets('COACH', 1))[0] ?? null

  let sentCount = 0
  for (const coach of coaches) {
    try {
      const uniqueRoles = new Map<string, { roleType: string; primaryFunction: string | null; city: string | null; state: string | null }>()
      for (const client of coach.clients) {
        if (!client.targetRoleType) continue
        const key = `${client.targetRoleType}|${client.currentState ?? ''}`
        if (!uniqueRoles.has(key)) {
          uniqueRoles.set(key, {
            roleType: client.targetRoleType,
            primaryFunction: client.primaryFunction,
            city: client.currentCity,
            state: client.currentState,
          })
        }
      }

      const roleEntries = Array.from(uniqueRoles.values()).slice(0, MAX_ROLE_LINES)
      const roleLines = await Promise.all(
        roleEntries.map(async (r) => {
          const mc = await getMarketConditions({ roleType: r.roleType, primaryFunction: r.primaryFunction, city: r.city, state: r.state })
          return { roleType: r.roleType, adzunaCount: mc.adzunaCount }
        })
      )

      if (roleLines.length === 0 && !nugget) continue

      const result = await sendMarketDigestCoachEmail(coach, roleLines, nugget)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Coach market digest failed for coach', coach.id, error)
    }
  }

  if (sentCount > 0) {
    await recordDigestSend('coach', sentCount, nugget ? [nugget.id] : [])
    if (nugget) await markItemsSent([nugget.id], 'COACH')
  }

  return NextResponse.json({ checked: coaches.length, sent: sentCount })
}
