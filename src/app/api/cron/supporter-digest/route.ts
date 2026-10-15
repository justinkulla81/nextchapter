import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCronRun } from '@/lib/cron/run'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildSupporterSummary, supporterHeadline } from '@/lib/supporters/summary'
import { sendSupporterDigestEmail } from '@/lib/email/send-supporter-email'

export const maxDuration = 300

// Weekly note to each member's supporters. SHIPS DISABLED: it emails people
// outside NextChapter, so nothing is sent unless SUPPORTER_DIGEST_ENABLED=true.
// ?dryRun=1 lists who would be emailed (no sends) and works with the flag off.
export const GET = withCronRun('supporter-digest', async (request: NextRequest) => {
  const dryRun = ['1', 'true'].includes(request.nextUrl.searchParams.get('dryRun') ?? '')
  if (process.env.SUPPORTER_DIGEST_ENABLED !== 'true' && !dryRun) {
    return NextResponse.json({ enabled: false, message: 'SUPPORTER_DIGEST_ENABLED is not true. Nothing sent. Use ?dryRun=1 to preview.' })
  }
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  const due = await prisma.searchSupporter.findMany({
    where: { revokedAt: null, OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: sixDaysAgo } }] },
    select: { id: true, candidateId: true, name: true, email: true, token: true },
    take: 200,
  })
  let sent = 0
  const wouldSend: string[] = []
  for (const s of due) {
    const summary = await buildSupporterSummary(s.candidateId)
    if (!summary) continue // confidential or gone: say nothing
    if (dryRun) {
      wouldSend.push(s.id)
      continue
    }
    const r = await sendSupporterDigestEmail({
      to: s.email,
      supporterName: s.name,
      headline: supporterHeadline(summary),
      token: s.token,
      stats: [
        ['Minutes this week', summary.minutesThisWeek],
        ['Days active', summary.daysActive],
        ['Actions done', summary.actionsDone],
        ['Messages sent', summary.messagesSent],
      ],
    })
    if (r) {
      await prisma.searchSupporter.update({ where: { id: s.id }, data: { lastDigestAt: new Date() } })
      captureServerEvent(s.candidateId, 'supporter_digest_sent', { supporterId: s.id, minutes: summary.minutesThisWeek })
      sent += 1
    }
  }
  return NextResponse.json(dryRun ? { dryRun: true, wouldSend } : { checked: due.length, sent })
})
