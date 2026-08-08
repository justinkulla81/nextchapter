import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'

export const maxDuration = 30

// Admin's own view of a candidate's Executive Dossier — unlike the
// recruiter-facing version, not gated on privacyTier or grade, since admin
// needs to see every candidate's profile regardless of what's been unlocked
// externally.
export default async function AdminCandidateProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!candidate) notFound()

  const dossier = await getDossierSections(id)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link href={`/support/admin/candidates/${id}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to candidate
      </Link>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Profile / Executive Dossier</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {[candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Unnamed'}
        </h1>
      </div>

      <div className="space-y-5">
        <DossierSectionsView dossier={dossier} readOnly />
      </div>
    </div>
  )
}
