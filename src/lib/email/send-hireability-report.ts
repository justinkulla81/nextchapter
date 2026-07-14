import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import HireabilityReportEmail from '@/emails/hireability-report'

interface Strength {
  title: string
  detail: string
}

export async function sendHireabilityReportEmail(candidateId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping hireability report email.')
    return { sent: false as const }
  }

  try {
    const [candidate, report] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.hireabilityReport.findFirst({
        where: { candidateId },
        orderBy: { generatedAt: 'desc' },
      }),
    ])

    if (!report) return { sent: false as const }

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const strengths = report.strengths as unknown as Strength[]
    const weaknesses = report.weaknesses as unknown as Strength[]

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject: 'Your NextChapter Hireability Report is ready',
      react: HireabilityReportEmail({
        candidateName: candidate.displayName || 'there',
        topStrengths: strengths.slice(0, 3),
        topWeakness: weaknesses[0] ?? null,
        reportUrl: `${appUrl}/dashboard/hireability-report`,
      }),
    })

    if (error) {
      console.error('Failed to send hireability report email:', error)
      return { sent: false as const }
    }

    await prisma.hireabilityReport.update({
      where: { id: report.id },
      data: { emailSentAt: new Date() },
    })

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break report generation.
    console.error('Failed to send hireability report email:', error)
    return { sent: false as const }
  }
}
