import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { GRADE_LABEL, type HireabilityGrade } from '@/lib/scoring/grade'
import type { MarketResponseSnapshot } from '@/lib/reports/market-response'
import SundayNightReportEmail from '@/emails/sunday-night-report'

interface Strength {
  title: string
  detail: string
}

interface SuggestedActionItem {
  text: string
  actionType?: string
  isAStandard: boolean
  isStretch?: boolean
}

export async function sendSundayNightReportEmail(candidateId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Sunday Night Report email.')
    return { sent: false as const }
  }

  try {
    const [candidate, report] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.sundayNightReport.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'desc' } }),
    ])
    if (!report) return { sent: false as const }

    const weekNumber = await prisma.sundayNightReport.count({
      where: { candidateId, generatedAt: { lte: report.generatedAt } },
    })

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const grade = report.gradeSnapshot as unknown as HireabilityGrade
    const isFirstWeek = report.previousGradeSnapshot === null
    const strengths = report.strengths as unknown as Strength[]
    const weaknesses = report.weaknesses as unknown as Strength[]
    const suggestedActionPlan = report.suggestedActionPlan as unknown as SuggestedActionItem[]
    const marketResponse = report.marketResponse as unknown as MarketResponseSnapshot | null

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=weekly`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <hello@launchyournextchapter.com>',
      replyTo: 'justin.kulla@gmail.com',
      to: email,
      subject: candidate.firstName ? `Your Sunday Night Report, ${candidate.firstName}` : 'Your Sunday Night Report',
      react: SundayNightReportEmail({
        firstName: candidate.firstName,
        isFirstWeek,
        marketRealityGrade: grade.marketReality.grade,
        marketRealityLabel: GRADE_LABEL[grade.marketReality.grade],
        searchExecutionGrade: isFirstWeek ? null : grade.searchExecution.grade,
        searchExecutionLabel: isFirstWeek ? null : GRADE_LABEL[grade.searchExecution.grade],
        lastWeekCommittedCount: report.lastWeekCommittedCount,
        lastWeekCompletedCount: report.lastWeekCompletedCount,
        topStrength: strengths[0] ?? null,
        topWeakness: weaknesses[0] ?? null,
        straightTalk: report.straightTalk,
        aStandardActions: suggestedActionPlan.filter((a) => a.isAStandard).map((a) => a.text),
        onAList: report.onAList,
        aListCount: report.aListCount,
        marketResponse,
        weekNumber,
        reportUrl: `${appUrl}/dashboard/weekly-report`,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Sunday Night Report email:', error)
      return { sent: false as const }
    }

    await prisma.sundayNightReport.update({ where: { id: report.id }, data: { emailSentAt: new Date() } })
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Sunday Night Report email:', error)
    return { sent: false as const }
  }
}
