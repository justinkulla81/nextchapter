import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Skills & Behavioral Assessments' }

export default async function SkillsAssessmentsPage() {
  const profile = await getDashboardData()

  const latestWorkStyleResponse = await prisma.candidateAssessmentResponse.findFirst({
    where: { candidateId: profile.id },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  })

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">How I Work Best</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A quick quad-block quiz on your working style — how you operate, decide, and
              collaborate.
            </p>
            <p className="text-xs text-muted-foreground">
              {latestWorkStyleResponse
                ? `Last completed ${latestWorkStyleResponse.completedAt.toLocaleDateString()}`
                : 'Not completed yet'}
            </p>
            <Button nativeButton={false} render={<Link href="/dashboard/retake-assessment" />} size="sm">
              {latestWorkStyleResponse ? 'Retake' : 'Take the quiz'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">Skills Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A candid self-read on your core function, AI fluency, and a few other skills that
              drive how jobs and courses get matched to you.
            </p>
            <p className="text-xs text-muted-foreground">
              {profile.skillsAssessmentCompletedAt
                ? `Last completed ${profile.skillsAssessmentCompletedAt.toLocaleDateString()}`
                : 'Not completed yet'}
            </p>
            <Button nativeButton={false} render={<Link href="/dashboard/skills-assessment" />} size="sm">
              {profile.skillsAssessmentCompletedAt ? 'Retake' : 'Take the assessment'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
