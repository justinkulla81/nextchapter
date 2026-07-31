import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { ThoughtLeadershipStudio } from '@/components/dashboard/ThoughtLeadershipStudio'
import { ThoughtLeadershipUnlockForm } from '@/components/dashboard/ThoughtLeadershipUnlockForm'
import { SubstackSection } from '@/components/dashboard/SubstackSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CONTENT_TUTORIALS, CONTENT_VENUE_LABEL } from '@/lib/constants/content-venues'
import { SprintActionCompletion } from '@/components/dashboard/SprintActionCompletion'
import { MyStoryTab } from '@/components/dashboard/interview-prep/MyStoryTab'
import { AlternativeNarrativeTabs } from '@/components/dashboard/marketing-plan/AlternativeNarrativeTabs'
import type { NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

export const metadata: Metadata = { title: 'My Marketing Plan' }


export default async function MarketingPlanPage() {
  const profile = await getDashboardData()
  const unlocked = profile.contentComfortLevel !== null && profile.contentVenues.length > 0

  if (!unlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Marketing Plan</h1>
          <p className="mt-1 text-muted-foreground">
            You&apos;re the product right now — this is where you plan how you get in front of
            people. Post ideas grounded in your actual background — pick one, get a draft, edit it
            so it sounds like you, and post.
          </p>
        </div>
        <ThoughtLeadershipUnlockForm />
      </div>
    )
  }

  const relevantTutorials = CONTENT_TUTORIALS.filter((t) => profile.contentVenues.includes(t.venue))

  const narrativeRows = await prisma.candidateNarrative.findMany({
    where: { candidateId: profile.id },
    orderBy: { generatedAt: 'asc' },
  })
  const narratives: NarrativeItem[] = narrativeRows.map((n, i) => ({
    id: n.id,
    label: n.label,
    coreStatement: n.coreStatement,
    adaptations: (n.adaptations as unknown as NarrativeAdaptations | null) ?? null,
    isDefault: i === 0,
  }))
  const defaultNarrative = narratives[0] as NarrativeItem | undefined
  const alternativeNarratives = narratives.slice(1)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Marketing Plan</h1>
        <p className="mt-1 text-muted-foreground">
          You&apos;re the product right now — this is where you plan how you get in front of
          people. Post ideas grounded in your actual background — pick one, get a draft, edit it so
          it sounds like you, and post.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Posting is one of the highest-leverage things you can do right now — it&apos;s how
          recruiters and your network see you&apos;re active before you ever apply anywhere, and
          consistent activity shows up on your Certified Executive Dossier as a real, visible signal, not a
          resume claim.
        </p>
        <SprintActionCompletion
          candidateId={profile.id}
          actionTypes={['LINKEDIN_POST_IDEA', 'THOUGHT_LEADERSHIP_COMMENT', 'THOUGHT_LEADERSHIP_SHARE']}
        />
      </div>

      <div className="space-y-1.5 rounded-lg border border-border bg-off-white p-4 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Core Narrative</span> is your default
          professional story — draft it once and everything you post can adapt from it, including
          your LinkedIn headline, resume summary, and email openings.
        </p>
        <p>
          <span className="font-medium text-foreground">Alternative narratives</span> let you tell
          a different version of your story for a specific scenario — a layoff, a pivot, a return
          after time off — each with its own email opening, 30-second verbal pitch, and more.
        </p>
        <p>
          <span className="font-medium text-foreground">Tutorials</span> below are matched to the
          venues you said you&apos;d post on. Everything you post shows up on your Certified
          Executive Dossier as real, visible activity — not just a resume claim.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Core Narrative</h2>
        <MyStoryTab
          coreStatement={defaultNarrative?.coreStatement ?? null}
          adaptations={defaultNarrative?.adaptations ?? null}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Alternative Narratives</h2>
        <p className="text-sm text-muted-foreground">
          Need a different story for a specific scenario? Draft as many alternative narratives as
          you need, each in its own tab below.
        </p>
        <AlternativeNarrativeTabs alternatives={alternativeNarratives} />
      </div>

      {relevantTutorials.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Tutorials for your venues</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relevantTutorials.flatMap((group) =>
              group.tutorials.map((tutorial) => (
                <Card key={tutorial.url}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <a
                        href={tutorial.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-4"
                      >
                        {tutorial.name}
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {CONTENT_VENUE_LABEL[group.venue]}
                    </p>
                    <p className="text-sm text-muted-foreground">{tutorial.description}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {profile.contentVenues.includes('SUBSTACK') && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Substack</h2>
          <SubstackSection
            hasAccount={profile.substackHasAccount}
            url={profile.substackUrl}
            critique={profile.substackCritique as unknown as SubstackCritique | null}
          />
        </div>
      )}

      <ThoughtLeadershipStudio
        venues={profile.contentVenues}
        substackUnlocked={profile.substackHasAccount !== null}
      />
    </div>
  )
}

interface SubstackCritique {
  relevanceToBackground: string
  noveltyOfIdeas: string
  cadence: string
  overallAssessment: string
}
