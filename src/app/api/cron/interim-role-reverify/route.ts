import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInterimRoleCheckInEmail } from '@/lib/email/send-interim-role-check-in'

const REVERIFY_INTERVAL_DAYS = 30

// Fires daily. Victoria checks in roughly every 30 days (or at the stated
// expectedEndDate, if given) on any active fractional/interim engagement —
// "Still doing your interim work at [Company]?" — so isCurrent/endDate stay
// current, since the resume's "one active engagement at a time" rule
// (sanitize.ts) depends on this being accurate, not stale.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dueEntries = await prisma.workHistoryEntry.findMany({
    where: {
      isCurrent: true,
      engagementType: { in: ['FRACTIONAL', 'INTERIM'] },
      OR: [
        { nextReverifyAt: null },
        { nextReverifyAt: { lte: now } },
        { expectedEndDate: { lte: now } },
      ],
    },
    include: { candidate: { select: { id: true, userId: true, firstName: true } } },
  })

  let sent = 0
  for (const entry of dueEntries) {
    try {
      const result = await sendInterimRoleCheckInEmail(entry.candidate, {
        id: entry.id,
        companyName: entry.companyName,
      })
      if (result.sent) {
        sent += 1
        // Don't re-send daily while awaiting a response — next automatic
        // check-in is scheduled for the standard interval either way; if
        // the candidate responds sooner via the email links, those routes
        // overwrite this.
        await prisma.workHistoryEntry.update({
          where: { id: entry.id },
          data: { nextReverifyAt: new Date(now.getTime() + REVERIFY_INTERVAL_DAYS * 86400000) },
        })
      }
    } catch (error) {
      console.error('Interim role check-in failed for entry', entry.id, error)
    }
  }

  return NextResponse.json({ checked: dueEntries.length, sent })
}
