import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { getCoachingNotes } from '@/lib/coach/coaching-notes'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { CoachingNotesPanel } from '@/components/coach/CoachingNotesPanel'
import { captureServerEvent } from '@/lib/posthog/server'

export const metadata: Metadata = { title: 'Coach Dossier & Notes' }


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

  const [dossier, coachingNotes] = await Promise.all([
    getDossierSections(profile.id),
    getCoachingNotes(profile.id),
  ])

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
        <DossierSectionsView dossier={dossier} readOnly />
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
