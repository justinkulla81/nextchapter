import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

export const metadata: Metadata = { title: 'Skills & Behavioral Assessments' }

export default async function SkillsAssessmentsPage() {
  const profile = await getDashboardData()

  const latestWorkStyleResponse = await prisma.candidateAssessmentResponse.findFirst({
    where: { candidateId: profile.id },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  })

  const assessments = [
    {
      key: 'working-style',
      title: 'How I Work Best',
      description:
        'A quick quad-block quiz on your working style — how you operate, decide, and collaborate.',
      completedAt: latestWorkStyleResponse?.completedAt ?? null,
      points: estimateActionEffort({ actionType: 'WORKING_STYLE_QUIZ' }).points,
      href: '/dashboard/retake-assessment',
      ctaLabel: latestWorkStyleResponse ? 'Retake' : 'Take the quiz',
    },
    {
      key: 'skills',
      title: 'Skills Assessment',
      description:
        'A candid self-read on your core function, AI fluency, and a few other skills that drive how jobs and courses get matched to you.',
      completedAt: profile.skillsAssessmentCompletedAt,
      points: estimateActionEffort({ actionType: 'SKILLS_ASSESSMENT_COMPLETED' }).points,
      href: '/dashboard/skills-assessment',
      ctaLabel: profile.skillsAssessmentCompletedAt ? 'Retake' : 'Take the assessment',
    },
    // Not-completed first — that's the one thing actually asking for
    // attention on this page.
  ].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt))

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Skills & Behavioral Assessments</h1>
        <p className="text-muted-foreground">
          These personalize your Job Recommendations, Skills Recommendations, and Hireability
          Report — the more current they are, the better the matches.
        </p>
        <PageHeaderBoxes pageKey="skills-assessments" candidateId={profile.id} />
      </div>

      <div className="space-y-4">
        {assessments.map((assessment) => (
          <Card key={assessment.key}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base font-medium text-foreground">{assessment.title}</CardTitle>
              {!assessment.completedAt && (
                <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand tabular-nums">
                  +{assessment.points} pts
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{assessment.description}</p>
              <p className="text-xs text-muted-foreground">
                {assessment.completedAt
                  ? `Last completed ${assessment.completedAt.toLocaleDateString()}`
                  : 'Not completed yet'}
              </p>
              <Button nativeButton={false} render={<Link href={assessment.href} />} size="sm">
                {assessment.ctaLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
