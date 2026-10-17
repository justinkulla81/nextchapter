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
import { ToolsChecklist } from '@/components/dashboard/ToolsChecklist'
import { suggestAiOptions, suggestTools } from '@/lib/profile/tools-checklist'
import { memberIndustryBuckets } from '@/lib/profile/industry-reading'

export const metadata: Metadata = { title: 'Skills Inventory' }

export default async function SkillsAssessmentPage() {
  const profile = await getDashboardProfile()
  // "Tools you use": their occupation's tools, the ones they already name pre-checked (tools-checklist.ts).
  const tools = (await suggestTools(profile).catch(() => [])).map((t) => ({ name: t.name, checked: t.checked }))
  // "AI you use": the AI tools and skills postings in their function and industry name most (ai-skill-market.ts).
  const aiTools = suggestAiOptions({ ...profile, industries: memberIndustryBuckets(profile) }).map((t) => ({ name: t.name, checked: t.checked }))

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
            skill gaps all use this list.{' '}
            {!profile.toolsConfirmedAt && (
              <a href="#tools" className="text-primary underline underline-offset-4">
                Confirm the tools you use
              </a>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <SkillMatrix
            rows={buildSkillMatrix(profile)}
            removed={Object.entries(readSkillLevels(profile.skillLevels)).filter(([, v]) => v.removed).map(([k]) => k)}
          />
          <div className="mt-6 border-t border-border pt-4">
            <ToolsChecklist options={tools} aiOptions={aiTools} confirmedAt={profile.toolsConfirmedAt?.toISOString() ?? null} />
          </div>
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
