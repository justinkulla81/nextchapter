import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { SkillsAssessmentForm } from '@/components/dashboard/SkillsAssessmentForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkillMatrix } from '@/components/dashboard/SkillMatrix'
import { WorkStylePrompt } from '@/components/dashboard/WorkStylePrompt'
import { LikesCard } from '@/components/dashboard/LikesCard'
import { readLikes } from '@/lib/profile/work-profile'
import { buildSkillMatrix, readSkillLevels } from '@/lib/profile/skill-matrix'

export const metadata: Metadata = { title: 'Skills Inventory' }

export default async function SkillsAssessmentPage() {
  const profile = await getDashboardProfile()

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
          Recommendations, and Market Reality Report. Retake it any time your confidence in an area
          changes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your skills matrix</CardTitle>
          <p className="text-sm text-muted-foreground">
            Everything we know you can do: from your resume, skills you added and your certifications. Set how strong each one is. Your job matches, pivot paths and
            skill gaps all use this list.
          </p>
        </CardHeader>
        <CardContent>
          <SkillMatrix
            rows={buildSkillMatrix(profile)}
            removed={Object.entries(readSkillLevels(profile.skillLevels)).filter(([, v]) => v.removed).map(([k]) => k)}
          />
        </CardContent>
      </Card>

      <WorkStylePrompt candidateId={profile.id} all />

      <LikesCard initial={readLikes(profile.workStyleAnswers)} />

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
