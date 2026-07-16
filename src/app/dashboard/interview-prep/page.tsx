import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { InterviewPrepTabs } from '@/components/dashboard/interview-prep/InterviewPrepTabs'
import { JobDescriptionCard } from '@/components/dashboard/interview-prep/JobDescriptionCard'
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

      <JobDescriptionCard initialValue={profile.activeJobDescription} />

      <div className="space-y-1.5 rounded-lg border border-border bg-off-white p-4 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">My Story</span> is your core narrative,
          written from your background and how you described yourself earlier in the app — it
          adapts automatically if you add a job description above.
        </p>
        <p>
          <span className="font-medium text-foreground">Tough Questions</span> are generated from
          your target role and experience — the ones most likely to actually come up, not a
          generic list.
        </p>
        <p>
          <span className="font-medium text-foreground">Practice</span> lets you rehearse answers
          out loud and get feedback before it counts.
        </p>
        <p>
          <span className="font-medium text-foreground">Thank You Emails</span> are drafted from
          the actual interview details you give it, ready to personalize and send.
        </p>
        <p>
          <span className="font-medium text-foreground">Comfort Check</span> is a quick
          self-assessment — how ready you feel telling your story, handling questions, and
          pitching yourself — so you can see where to focus next.
        </p>
      </div>

      <InterviewPrepTabs
        coreStatement={narrative?.coreStatement ?? null}
        adaptations={(narrative?.adaptations as unknown as NarrativeAdaptations | null) ?? null}
        targetRoleType={profile.targetRoleType}
        storyComfort={profile.storyComfort}
        interviewComfort={profile.interviewComfort}
        elevatorPitchReady={profile.elevatorPitchReady}
        hasJobDescription={!!profile.activeJobDescription}
      />
    </div>
  )
}
