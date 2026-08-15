import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clearDossierGeneratedCache } from '@/lib/reports/dossier-refresh'
import { sendMembershipNoticeEmail } from '@/lib/email/send-membership-notice'
import { captureServerEvent } from '@/lib/posthog/server'

const REFRESH_INTERVAL_DAYS = 365

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// §A2.4 "annual Dossier refresh" — a real, triggerable regeneration, reusing
// the exact same cache-clear the candidate's own manual "Regenerate" button
// uses (clearDossierGeneratedCache, extracted from regenerateDossierSections
// in src/app/dashboard/recruiter-report/actions.ts). Runs daily, scans for
// members due (never refreshed, or refreshed >365 days ago) — same daily-
// scan-for-individually-due-rows shape as interim-role-reverify.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - REFRESH_INTERVAL_DAYS)

  const due = await prisma.membershipSubscription.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ lastDossierRefreshAt: null }, { lastDossierRefreshAt: { lt: cutoff } }],
    },
    select: { candidateId: true, candidate: { select: { email: true, firstName: true } } },
  })

  let refreshedCount = 0
  for (const subscription of due) {
    try {
      await clearDossierGeneratedCache(subscription.candidateId)
      await prisma.membershipSubscription.update({
        where: { candidateId: subscription.candidateId },
        data: { lastDossierRefreshAt: new Date() },
      })
      if (subscription.candidate.email) {
        await sendMembershipNoticeEmail({
          to: subscription.candidate.email,
          subject: 'Your annual Dossier refresh is ready',
          heading: 'Your Dossier just got a refresh',
          bodyLines: [
            `Hi ${subscription.candidate.firstName ?? 'there'} — as a NextChapter Member, your Executive Dossier gets an annual refresh. The next time you open it, everything regenerates with your latest activity.`,
          ],
          ctaLabel: 'View your Dossier',
          ctaUrl: `${appUrl()}/dashboard/recruiter-report`,
        })
      }
      captureServerEvent(subscription.candidateId, 'membership_dossier_refresh_triggered', {})
      refreshedCount += 1
    } catch (error) {
      console.error('Membership Dossier refresh failed for candidate', subscription.candidateId, error)
    }
  }

  return NextResponse.json({ checked: due.length, refreshed: refreshedCount })
}
