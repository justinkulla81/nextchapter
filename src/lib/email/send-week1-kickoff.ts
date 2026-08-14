import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { getWeek1Artifacts } from '@/lib/sprint/week1'
import type { ActionDay } from '@/lib/daily/primary-action'
import Week1KickoffEmail from '@/emails/week1-kickoff'

// Victoria's Day 2 kickoff — one-time onboarding email, the first full day
// after registration. Independent of the weekly email cadence (it isn't
// gated by day-of-week or notification tier beyond MINIMAL exclusion, both
// applied by the caller's eligibility query) — extracted to its own sender/
// cron so it can't be crowded out by the 7-day dispatcher schedule.
export async function sendWeek1Kickoff(candidateId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Week 1 kickoff email.')
    return { sent: false as const }
  }

  try {
    const [candidate, report] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.marketRealityReport.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'desc' } }),
    ])

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=daily`

    const [jobPostings, linkedInActivityLogs, narrative, outreachCount] = await Promise.all([
      prisma.jobPosting.findMany({ where: { candidateId }, select: { coverLetter: true } }),
      prisma.linkedInActivityLog.findMany({ where: { candidateId }, select: { id: true } }),
      prisma.candidateNarrative.findFirst({ where: { candidateId } }),
      prisma.outreachLog.count({ where: { candidateId } }),
    ])
    const artifacts = getWeek1Artifacts({
      linkedInPosted: linkedInActivityLogs.length > 0,
      coverLetterGenerated: jobPostings.some((j) => !!j.coverLetter),
      narrativeGenerated: !!narrative,
      outreachLogged: outreachCount > 0,
    })

    const firstDay = report ? (report.actionPlan as unknown as ActionDay[])[0] : undefined
    const topActions = (firstDay?.items ?? []).slice(0, 3).map((item) => (typeof item === 'string' ? item : item.text))

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject: candidate.firstName
        ? `Your Day 2 action plan is ready, ${candidate.firstName}`
        : 'Your Day 2 action plan is ready',
      react: Week1KickoffEmail({
        firstName: candidate.firstName,
        victoriaName: getVictoriaName('introduction'),
        artifactLabels: artifacts.map((a) => a.label),
        topActions,
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Week 1 kickoff email:', error)
      return { sent: false as const }
    }

    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { lastDailyEmailSentAt: new Date() } })
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Week 1 kickoff email:', error)
    return { sent: false as const }
  }
}
