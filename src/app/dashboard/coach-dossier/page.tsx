import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { getCoachingNotes } from '@/lib/coach/coaching-notes'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { CoachingNotesPanel } from '@/components/coach/CoachingNotesPanel'
import { Spinner } from '@/components/ui/spinner'
import { captureServerEvent } from '@/lib/posthog/server'
import { CandidateReassignmentRequestForm } from '@/components/dashboard/CandidateReassignmentRequestForm'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'

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
  const redesign = isRedesignOn(profile.email)

  if (!profile.coachId) {
    if (redesign) {
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
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Coach Dossier &amp; Notes</h1>
        <p className="text-muted-foreground">
          This is where you&apos;d see exactly what your coach sees about you — but you don&apos;t have a
          coach connected yet.
        </p>
      </div>
    )
  }

  const hasConsented = profile.coachDossierConsentedAt !== null
  // The notes lookup only matters once sharing is on, and doesn't depend on the
  // coach row, so start both together.
  const [coach, coachingNotes] = await Promise.all([
    prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } }),
    hasConsented ? getCoachingNotes(profile.id) : Promise.resolve(null),
  ])

  if (!hasConsented && redesign) {
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

  if (!hasConsented) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coach Dossier &amp; Notes</h1>
          <p className="mt-1 text-muted-foreground">
            This is exactly what {coach?.fullName ?? 'your coach'} would see when preparing for your
            sessions — but you haven&apos;t turned on sharing yet, so it&apos;s off for both of you.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Without it, {coach?.fullName ?? 'your coach'} walks into every session blind — no
            grade history, no named strengths or gaps, nothing from your references. Turning it on
            means less time re-explaining your background and more time actually coaching.
          </p>
        </div>
        <Link
          href="/dashboard/privacy"
          className="inline-flex items-center rounded-md bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          Turn on sharing in Privacy Settings
        </Link>
        <div className="border-t border-border pt-4">
          <CandidateReassignmentRequestForm />
        </div>
      </div>
    )
  }

  captureServerEvent(profile.id, 'coach_dossier_self_viewed')

  return (
    <div className="space-y-6">
      {redesign ? (
        <PageHeader
          title="What your coach sees"
          intro={`Exactly what ${coach?.fullName ?? 'your coach'} sees when preparing for your sessions. It stays in the app and cannot be downloaded or forwarded from here.`}
        />
      ) : (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coach Dossier &amp; Notes</h1>
        <p className="mt-1 text-muted-foreground">
          Exactly what {coach?.fullName ?? 'your coach'} sees when preparing for your sessions — in-app
          only, never downloadable, exportable, or forwardable from here.
        </p>
      </div>
      )}

      <div className="space-y-5">
        <Suspense fallback={<DossierSkeleton />}>
          <DossierSection candidateId={profile.id} />
        </Suspense>
      </div>

      <div className="border-t border-border pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coaching Notes
        </p>
        <CoachingNotesPanel notes={coachingNotes!} />
      </div>

      <div className="border-t border-border pt-6">
        <CandidateReassignmentRequestForm />
      </div>
    </div>
  )
}
