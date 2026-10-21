import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { getCoachingNotes } from '@/lib/coach/coaching-notes'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { CoachingNotesPanel } from '@/components/coach/CoachingNotesPanel'
import { Spinner } from '@/components/ui/spinner'
import { captureServerEvent } from '@/lib/posthog/server'
import { CandidateReassignmentRequestForm } from '@/components/dashboard/CandidateReassignmentRequestForm'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { Section } from '@/components/candidate/ui'

export const metadata: Metadata = { title: 'Coach Dossier & Notes' }

// getDossierSections chains up to 4 live Anthropic calls (positioning
// statement, job pattern, proof points) plus an LLM-per-employer loop via
// getCandidateLevelRank/resolveCompanySizeBand — all self-caching after the
// first successful generation, but a real cost on first view or after a
// regenerate. Isolated in its own Suspense boundary so the page header and
// Coaching Notes (all fast Prisma reads/pure compute) render immediately.
async function DossierSection({ candidateId }: { candidateId: string }) {
  const dossier = await getDossierSections(candidateId)
  return <DossierSectionsView dossier={dossier} readOnly />
}

function DossierSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Putting together your dossier…
    </div>
  )
}

export default async function CoachDossierPage() {
  const profile = await getDashboardProfile()

  if (!profile.coachId) {
    return (
      <PageHeader
        title="What your coach sees"
        intro="This is where you see exactly what your coach sees about you. You do not have a coach yet, so there is nothing to share."
        action={
          <TrackedAction variant="primary" href="/dashboard/my-coaching" event="coaching_opened" properties={{ source: 'coach_dossier_no_coach' }}>
            Find a coach
          </TrackedAction>
        }
      />
    )
  }

  const hasConsented = profile.coachDossierConsentedAt !== null
  // The notes lookup only matters once sharing is on, and doesn't depend on the
  // coach row, so start both together.
  const [coach, coachingNotes] = await Promise.all([
    prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } }),
    hasConsented ? getCoachingNotes(profile.id) : Promise.resolve(null),
  ])

  if (!hasConsented) {
    const coachName = coach?.fullName ?? 'your coach'
    return (
      <div className="space-y-8">
        <PageHeader
          title="What your coach sees"
          intro={`Sharing is off, so ${coachName} sees nothing yet. Turn it on and ${coachName} walks into every session knowing your background, which means less time re-explaining and more time coaching.`}
          action={
            <TrackedAction variant="primary" href="/dashboard/privacy" event="coach_sharing_started" properties={{ source: 'coach_dossier' }}>
              Turn on sharing
            </TrackedAction>
          }
        />
        <ShowMore page="coach_dossier" label="Want a different coach?">
          <CandidateReassignmentRequestForm />
        </ShowMore>
      </div>
    )
  }

  captureServerEvent(profile.id, 'coach_dossier_self_viewed')

  // The dossier first, the coaching notes under a plain heading (the uppercase grey label is gone), and the
  // request for a different coach behind one control so it is not the last thing on a long page.
  return (
    <div className="space-y-8">
      <PageHeader
        title="What your coach sees"
        intro={`Exactly what ${coach?.fullName ?? 'your coach'} sees when preparing for your sessions. It stays in the app and cannot be downloaded or forwarded from here.`}
      />
      <Suspense fallback={<DossierSkeleton />}>
        <DossierSection candidateId={profile.id} />
      </Suspense>
      <Section id="coaching-notes" title="Coaching notes">
        <CoachingNotesPanel notes={coachingNotes!} />
      </Section>
      <ShowMore page="coach_dossier" label="Want a different coach?">
        <CandidateReassignmentRequestForm />
      </ShowMore>
    </div>
  )
}
