import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { SkillsAssessmentForm } from '@/components/dashboard/SkillsAssessmentForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Skills Inventory' }

export default async function SkillsAssessmentPage() {
  const profile = await getDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/skills-assessments"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Skills & Behavioral Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Skills Inventory</h1>
        <p className="mt-1 text-muted-foreground">
          A candid self-read on your skills — this personalizes your Job Recommendations, Skills
          Recommendations, and Hireability Report. Retake it any time your confidence in an area
          changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your skills</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillsAssessmentForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
