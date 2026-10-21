import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { InterviewPrepTabs } from '@/components/dashboard/interview-prep/InterviewPrepTabs'
import { JobDescriptionCard } from '@/components/dashboard/interview-prep/JobDescriptionCard'
import { WeaknessGuidanceCard } from '@/components/dashboard/portfolio/WeaknessGuidanceCard'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'
import { CultureQuestionsCard } from '@/components/dashboard/interview-prep/CultureQuestionsCard'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { getDefaultNarrative } from '@/lib/narrative/get-default-narrative'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { detectNarrativeWeaknesses } from '@/lib/narrative/detect-narrative-weaknesses'

export const metadata: Metadata = { title: 'Interview Prep' }


export default async function InterviewPrepPage() {
  const profile = await getDashboardProfile()
  const [narrative, weaknessGuidance] = await Promise.all([
    getDefaultNarrative(profile.id),
    detectNarrativeWeaknesses(profile.id),
  ])

  const tabs = (
    <InterviewPrepTabs
      coreStatement={narrative?.coreStatement ?? null}
      adaptations={(narrative?.adaptations as unknown as NarrativeAdaptations | null) ?? null}
      targetRoleType={profile.targetRoleType}
      storyComfort={profile.storyComfort}
      interviewComfort={profile.interviewComfort}
      elevatorPitchReady={profile.elevatorPitchReady}
      hasJobDescription={!!profile.activeJobDescription}
      jobHoppingFlag={profile.jobHoppingFlag}
    />
  )
  const weakness = (
    <WeaknessGuidanceCard
      guidance={weaknessGuidance}
      showGapForm
      gapExplanation={profile.gapExplanation}
      includeGapExplanationInDossier={profile.includeGapExplanationInDossier}
    />
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Interviews"
        intro="Get ready for the next one, and practice the questions that decide offers."
        action={
          <ActionLink href="#practice" kind="primary" event="interview_prep_start_clicked" props={{ hasJobDescription: !!profile.activeJobDescription, hasStory: !!narrative?.coreStatement }}>
            Start practicing
          </ActionLink>
        }
      />
      <JobDescriptionCard initialValue={profile.activeJobDescription} />
      <section id="practice" aria-label="Practice" className="scroll-mt-4">
        {tabs}
      </section>
      <ShowMore page="interview_prep">
        <CultureQuestionsCard cultureFit={profile.cultureFit} />
        {weakness}
        <GuideCallout pageSlot="interview-prep" currentJobStatus={profile.currentJobStatus} />
        <p className="text-sm text-muted-foreground">
          Getting ready for a review, raise or promotion conversation?{' '}
          <a href="/dashboard/review-prep" className="font-medium text-brand underline underline-offset-4">
            Build your case
          </a>
          .
        </p>
      </ShowMore>
    </div>
  )
}
