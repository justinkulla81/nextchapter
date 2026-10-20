import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { generateCoachShortlist } from '@/lib/coach/matching'
import { Spinner } from '@/components/ui/spinner'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { CoachPreferencesForm, CoachShortlistRedesign } from '@/components/coaching/CoachMatchRedesign'

export const metadata: Metadata = { title: 'Coach Matching' }

// generateCoachShortlist calls getCandidateLevelRank, which on a candidate's
// first-ever match request walks their work history through
// resolveCompanySizeBand per employer — isolated in its own Suspense
// boundary so the page header renders immediately either way.
async function CoachShortlist({ candidateId }: { candidateId: string }) {
  const shortlist = await generateCoachShortlist(candidateId)
  return <CoachShortlistRedesign shortlist={shortlist} />
}

export default async function CoachingMatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const profile = await getDashboardProfile()

  if (profile.coachId) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const showShortlist = params.step === 'shortlist'

  if (!showShortlist) {
    const saved = await prisma.coachingStyleResponse.findUnique({
      where: { candidateId: profile.id },
      select: { itemRatings: true },
    })
    const savedRatings = (saved?.itemRatings ?? {}) as Record<string, number>
    captureServerEvent(profile.id, 'coach_match_preferences_viewed', { hasSaved: Boolean(saved) })
    return (
      <div className="max-w-2xl space-y-8">
        <PageHeader title="Get matched with a coach" intro="A few quick preferences help us suggest coaches who work the way you like. Everything here is optional, so skip anything you have no preference on." />
        <CoachPreferencesForm
          gender={profile.coachGenderPreference}
          feedbackStyle={profile.coachCommunicationStylePreference}
          language={profile.coachLanguagePreference}
          timezone={profile.coachTimezonePreference}
          savedRatings={savedRatings}
        />
      </div>
    )
  }

  captureServerEvent(profile.id, 'coach_matches_viewed')
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Your coach matches" intro="Chosen for your target role, your level and your preferences. Each one says why." />
      <Suspense fallback={<p className="flex items-center gap-2 text-base text-ink"><Spinner size={16} />Finding your best coach matches…</p>}>
        <CoachShortlist candidateId={profile.id} />
      </Suspense>
    </div>
  )
}
