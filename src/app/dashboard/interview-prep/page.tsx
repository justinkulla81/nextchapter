import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { InterviewPrepTabs } from '@/components/dashboard/interview-prep/InterviewPrepTabs'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

export default async function InterviewPrepPage() {
  const profile = await getDashboardData()
  const narrative = await prisma.candidateNarrative.findUnique({ where: { candidateId: profile.id } })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interview Prep</h1>
        <p className="mt-1 text-muted-foreground">
          Your story, the tough questions, practice reps, and what to send afterward — all in one
          place.
        </p>
      </div>

      <InterviewPrepTabs
        coreStatement={narrative?.coreStatement ?? null}
        adaptations={(narrative?.adaptations as unknown as NarrativeAdaptations | null) ?? null}
        targetRoleType={profile.targetRoleType}
        storyComfort={profile.storyComfort}
        interviewComfort={profile.interviewComfort}
        elevatorPitchReady={profile.elevatorPitchReady}
      />
    </div>
  )
}
