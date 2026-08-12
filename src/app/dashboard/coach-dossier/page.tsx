import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { getCoachingNotes } from '@/lib/coach/coaching-notes'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { CoachingNotesPanel } from '@/components/coach/CoachingNotesPanel'
import { Spinner } from '@/components/ui/spinner'
import { captureServerEvent } from '@/lib/posthog/server'

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
  const profile = await getDashboardData()

  if (!profile.coachId) {
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

  const coach = await prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
  const hasConsented = profile.coachDossierConsentedAt !== null

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
      </div>
    )
  }

  const coachingNotes = await getCoachingNotes(profile.id)

  captureServerEvent(profile.id, 'coach_dossier_self_viewed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coach Dossier &amp; Notes</h1>
        <p className="mt-1 text-muted-foreground">
          Exactly what {coach?.fullName ?? 'your coach'} sees when preparing for your sessions — in-app
          only, never downloadable, exportable, or forwardable from here.
        </p>
      </div>

      <div className="space-y-5">
        <Suspense fallback={<DossierSkeleton />}>
          <DossierSection candidateId={profile.id} />
        </Suspense>
      </div>

      <div className="border-t border-border pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coaching Notes
        </p>
        <CoachingNotesPanel notes={coachingNotes} />
      </div>
    </div>
  )
}
