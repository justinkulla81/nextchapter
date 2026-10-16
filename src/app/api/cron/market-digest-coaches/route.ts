import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { sendMarketDigestCoachEmail } from '@/lib/email/send-market-digest-coach'
import { buildCoachWeeklyDigest } from '@/lib/coach/weekly-digest'
import { recordDigestSend, getDigestNuggets, markItemsSent } from '@/lib/admin/digest-composer'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

const MAX_ROLE_LINES = 3

// Vercel's default limit is far below what a serial pass over every coach
// needs (a single coach can spend ~100s in the digest budgets alone).
export const maxDuration = 300
const COACH_CONCURRENCY = 3
// Stop starting new coaches here so the run finishes cleanly (and records
// OK) instead of being killed at the limit with nothing recorded.
const DEADLINE_MS = 240_000
// The cron is weekly; a coach sent within this window is not sent again, so
// re-running the job after a partial run only reaches the coaches it missed.
const ALREADY_SENT_WINDOW_MS = 5 * 24 * 3_600_000

// Per-client: each client who has consented to coach access (the same
// coachDossierConsentedAt gate as the Full Client View) gets their own
// section — week, flags, activity and new strong-fit roles. Clients who
// haven't consented are listed by name only. The market snapshot rides
// along as a footer.
export const GET = withCronRun('market-digest-coaches', async () => {
  const coaches = await prisma.coach.findMany({
    where: {
      isSampleData: false,
      marketDigestOptedOut: false,
      OR: [{ marketDigestLastSentAt: null }, { marketDigestLastSentAt: { lt: new Date(Date.now() - ALREADY_SENT_WINDOW_MS) } }],
    },
    select: {
      id: true,
      fullName: true,
      workEmail: true,
      accessToken: true,
      clients: { select: { targetRoleType: true, primaryFunction: true, currentCity: true, currentState: true } },
    },
  })

  const nugget = (await getDigestNuggets('COACH', 1))[0] ?? null

  const startedAt = Date.now()
  let sentCount = 0
  let skippedForTime = 0
  let next = 0

  const processCoach = async (coach: (typeof coaches)[number]) => {
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

      const builtAt = Date.now()
      const digest = await buildCoachWeeklyDigest(coach.id, coach.accessToken)
      console.log(`Coach digest: built for ${coach.id.slice(0, 8)} in ${Date.now() - builtAt}ms (${digest.clients.length} shared, ${digest.unavailableNames.length} unavailable)`)
      if (digest.clients.length === 0 && roleLines.length === 0 && !nugget) return

      const result = await sendMarketDigestCoachEmail(coach, digest, roleLines, nugget)
      if (result.sent) {
        sentCount += 1
        // Best-effort: a failed stamp must not hide the send that happened.
        await prisma.coach
          .update({ where: { id: coach.id }, data: { marketDigestLastSentAt: new Date() } })
          .catch((e) => console.error('Coach market digest: could not stamp last-sent for', coach.id, e))
      }
    } catch (error) {
      console.error('Coach market digest failed for coach', coach.id, error)
    }
  }

  // Bounded concurrency: workers pull the next coach until none are left or
  // the deadline passes. Coaches not reached are counted, never silently lost.
  const worker = async () => {
    while (next < coaches.length) {
      const coach = coaches[next++]
      if (Date.now() - startedAt > DEADLINE_MS) {
        skippedForTime += 1
        continue
      }
      await processCoach(coach)
    }
  }
  await Promise.all(Array.from({ length: Math.min(COACH_CONCURRENCY, coaches.length) }, worker))
  if (skippedForTime > 0) console.error(`Coach market digest: ${skippedForTime} coach(es) not reached before the ${DEADLINE_MS}ms deadline`)

  if (sentCount > 0) {
    await recordDigestSend('coach', sentCount, nugget ? [nugget.id] : [])
    if (nugget) await markItemsSent([nugget.id], 'COACH')
  }

  const summary = { checked: coaches.length, sent: sentCount, skippedForTime }
  captureServerEvent('cron', 'coach_market_digest_run', summary)
  // Coaches left unsent make the run FAILED so the job watchdog emails about it.
  // The job is not auto-retried (it emails coaches); re-running it by hand is
  // safe because coaches already sent are skipped.
  return NextResponse.json(summary, { status: skippedForTime > 0 ? 500 : 200 })
})
