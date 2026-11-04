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
import { PageHeader } from '@/components/candidate/PageHeader'
import { MoreDetails } from '@/components/dashboard/MoreDetails'

export const metadata: Metadata = { title: 'Skills Inventory' }

export default async function SkillsAssessmentPage() {
  const profile = await getDashboardProfile()
  // "Tools you use": their occupation's tools, the ones they already name pre-checked (tools-checklist.ts).
  const tools = (await suggestTools(profile).catch(() => [])).map((t) => ({ name: t.name, checked: t.checked }))
  // "AI you use": the AI tools and skills postings in their function and industry name most (ai-skill-market.ts).
  const aiTools = suggestAiOptions({ ...profile, industries: memberIndustryBuckets(profile) }).map((t) => ({ name: t.name, checked: t.checked }))

  // Skills inventory in the redesign: your skills and the tools you use up front, the rest behind one fold.
  return (
    <div className="space-y-8">
      <PageHeader
        title="Skills inventory"
        intro="Tell us how strong you are at what you do. Your job matches, course picks and skill gaps all use this list, so it is worth keeping current."
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-semibold text-ink">Your skills matrix</CardTitle>
          <p className="text-sm text-muted-foreground">
            From your résumé, the skills you added and your certifications. Set how strong each one is.{' '}
            {!profile.toolsConfirmedAt && (
              <a href="#tools" className="font-medium text-brand underline underline-offset-4">
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
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-semibold text-ink">Your skills, in your words</CardTitle>
          <p className="text-sm text-muted-foreground">A candid read on your main function, your AI fluency and a few other skills. It only personalizes your matches, and no one else sees it.</p>
        </CardHeader>
        <CardContent>
          <SkillsAssessmentForm profile={profile} />
        </CardContent>
      </Card>
      <MoreDetails summary="Show more: how you like to work">
        <WorkStylePrompt candidateId={profile.id} all />
        <LikesCard initial={readLikes(profile.workStyleAnswers)} />
      </MoreDetails>
      <p className="text-sm text-muted-foreground">
        <Link href="/dashboard/skills-assessments" className="font-medium text-brand underline underline-offset-4">Back to how I work</Link>
      </p>
    </div>
  )
}
